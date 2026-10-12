"""Hosted deployment (Railway API, SEEDHA_ENV=production): start-up refusals,
CORS, sample-hotel-only accounts, owner-only reset, no paid Claude calls or
testnet writes for demo visitors, the real client address behind the proxy,
the lazy `app.main:app` entry point and the Railway files. Defaults (no
SEEDHA_ENV) are covered by the rest of the suite, unchanged."""

from __future__ import annotations

import asyncio
import json
import logging
import tomllib
from collections.abc import Iterator, MutableMapping
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker
from starlette.requests import Request
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.config import (
    PUBLISHED_DEMO_VALUES,
    ProductionConfigError,
    Settings,
    load_settings,
    production_problems,
)
from app.deps import get_settings
from app.main import LazyApp, create_app
from app.models import OwnerAccount
from app.public_mode import print_guarded
from app.routers.proof import chain_allowed

API_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = API_ROOT.parent.parent
PROD_TOKEN = "t" * 40
ORIGIN = "https://seedha-demo.example"
OWNER_PHONE = "9811122233"
FAKE_KEY = "not-a-real-key"
RAILWAY_PROXY = ("10.250.0.9", 40000)  # the platform proxy, the API's direct peer


def prod(settings: Settings, **changes: Any) -> Settings:
    """Settings that pass every production check."""
    base = replace(
        settings,
        production=True,
        owner_api_token=PROD_TOKEN,
        session_secret="s" * 40,
        desk_device_key="d" * 40,
        cors_origins=(ORIGIN,),
        database_url="postgresql://user@db.internal:5432/railway",
        seedha_demo=False,
    )
    return replace(base, **changes)


def headers(subject: str | None = None) -> dict[str, str]:
    out = {"Authorization": f"Bearer {PROD_TOKEN}"}
    if subject is not None:
        out["X-Seedha-Subject"] = subject
    return out


def preflight(origin: str) -> dict[str, str]:
    return {"Origin": origin, "Access-Control-Request-Method": "GET"}


def add_account(session: Session, phone: str = OWNER_PHONE) -> str:
    now = datetime(2026, 10, 12, tzinfo=UTC)
    account = OwnerAccount(name="Owner", hotel_name="Hotel Deodar View", phone=phone,
                           terms_accepted_at=now, verified_at=now)  # fmt: skip
    session.add(account)
    session.commit()
    return f"a{account.id}"


@pytest.fixture(name="prod_settings")
def fixture_prod_settings(settings: Settings) -> Settings:
    return prod(settings, owner_phones=frozenset({OWNER_PHONE}), allow_owner_accounts=True)


@pytest.fixture(name="hosted")
def fixture_hosted(prod_settings: Settings, factory: sessionmaker[Session]) -> Iterator[TestClient]:
    with TestClient(create_app(prod_settings, factory), client=RAILWAY_PROXY) as client:
        yield client


# --- Start-up checks -------------------------------------------------------------


def test_good_production_settings_pass(settings: Settings) -> None:
    assert not production_problems(prod(settings))


@pytest.mark.parametrize("value", ["", *sorted(PUBLISHED_DEMO_VALUES), "x" * 12,
                                   "my-token-change-me-please-0123456789"])  # fmt: skip
@pytest.mark.parametrize("field", ["session_secret", "owner_api_token", "desk_device_key"])
def test_unsafe_secrets_are_refused(settings: Settings, field: str, value: str) -> None:
    problems = production_problems(prod(settings, **{field: value}))
    assert [name for name, _ in problems] == [field.upper()]


@pytest.mark.parametrize(
    "origins", [(), ("*",), ("https://*.vercel.app",), ("http://seedha-demo.example",)]
)
def test_cors_origins_must_be_https_and_never_a_wildcard(
    settings: Settings, origins: tuple[str, ...]
) -> None:
    problems = production_problems(prod(settings, cors_origins=origins))
    assert [name for name, _ in problems] == ["WEB_ORIGIN"]


def test_sqlite_is_refused_in_production(settings: Settings) -> None:
    problems = production_problems(prod(settings, database_url="sqlite:///./seedha.db"))
    assert [name for name, _ in problems] == ["DATABASE_URL"]


def test_start_refused_names_the_variable_never_the_value(
    settings: Settings, factory: sessionmaker[Session], caplog: pytest.LogCaptureFixture
) -> None:
    demo_token = sorted(PUBLISHED_DEMO_VALUES)[0]
    with caplog.at_level(logging.ERROR, "seedha"), pytest.raises(ProductionConfigError) as err:
        create_app(prod(settings, owner_api_token=demo_token), factory)
    assert "OWNER_API_TOKEN" in str(err.value)
    assert "OWNER_API_TOKEN" in caplog.text
    assert demo_token not in caplog.text
    assert demo_token not in str(err.value)


def test_published_demo_values_match_env_example() -> None:
    lines = (REPO_ROOT / ".env.example").read_text().splitlines()
    env = dict(line.split("=", 1) for line in lines if "=" in line and not line.startswith("#"))
    demo = {env["OWNER_API_TOKEN"], env["SESSION_SECRET"], env["DESK_DEVICE_KEY"]}
    assert demo == PUBLISHED_DEMO_VALUES
    for name in ("SEEDHA_ENV", "ALLOW_OWNER_ACCOUNTS", "ALLOW_CLAUDE_FOR_DEMO",
                 "ALLOW_DEMO_PROOF_WRITES", "API_BASE_URL", "SEEDHA_HOSTED"):  # fmt: skip
        assert env[name] == ""


def test_load_settings_production_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SEEDHA_ENV", "production")
    monkeypatch.setenv("SEEDHA_DEMO", "1")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://seedha.example/, https://www.seedha.example")
    monkeypatch.setenv("WEB_ORIGIN", "https://seedha.example")
    monkeypatch.setenv("ALLOW_CLAUDE_FOR_DEMO", "1")
    got = load_settings()
    assert got.production
    assert not got.seedha_demo  # the OTP banner never shows in production
    assert got.cors_origins == ("https://seedha.example", "https://www.seedha.example")
    assert got.web_origin == "https://seedha.example/"
    assert got.allow_claude_for_demo
    assert not got.allow_owner_accounts and not got.allow_demo_proof_writes


def test_defaults_unchanged_without_seedha_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for name in ("SEEDHA_ENV", "PUBLIC_BASE_URL", "WEB_ORIGIN", "ALLOW_CLAUDE_FOR_DEMO"):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("SEEDHA_DEMO", "1")
    got = load_settings()
    assert not got.production and got.seedha_demo
    assert got.web_origin == "http://localhost:3000"
    assert "session_secret" not in repr(got)
    app = create_app(replace(got, owner_api_token="x"))
    with TestClient(app) as client:
        pre = client.options("/health", headers=preflight("http://localhost:3000"))
    assert pre.headers["access-control-allow-origin"] == "http://localhost:3000"


# --- CORS -------------------------------------------------------------------------


def test_cors_allows_only_the_listed_origins(
    settings: Settings, factory: sessionmaker[Session]
) -> None:
    other = "https://www.seedha-demo.example"
    app = create_app(prod(settings, cors_origins=(ORIGIN, other)), factory)
    with TestClient(app) as client:
        for origin in (ORIGIN, other):
            pre = client.options("/health", headers=preflight(origin))
            assert pre.headers["access-control-allow-origin"] == origin
        evil = client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in evil.headers


# --- Accounts: sample hotel only -----------------------------------------------------


@pytest.mark.usefixtures("sample")
def test_accounts_off_in_production_but_direct_beta_login_works(
    settings: Settings, factory: sessionmaker[Session]
) -> None:
    app = create_app(prod(settings, seedha_demo=True), factory)
    with TestClient(app) as client:
        for path, body in (("/auth/otp/request", {"phone": OWNER_PHONE}),
                           ("/auth/otp/verify", {"phone": OWNER_PHONE, "code": "123456"}),
                           ("/auth/signup", {"name": "Meera", "hotel": "Pine Crest",
                                             "phone": OWNER_PHONE, "terms": True})):  # fmt: skip
            res = client.post(path, headers=headers(), json=body)
            assert res.status_code == 403
            assert res.json()["error"]["code"] == "accounts_off"
        demo = client.post("/auth/demo", headers=headers())
    assert demo.status_code == 200 and demo.json()["subject"] == "demo"


@pytest.mark.usefixtures("sample")
def test_accounts_flag_opens_sign_in_without_the_demo_code(
    settings: Settings, factory: sessionmaker[Session]
) -> None:
    app = create_app(prod(settings, allow_owner_accounts=True, seedha_demo=True), factory)
    with TestClient(app) as client:
        res = client.post("/auth/otp/request", headers=headers(), json={"phone": OWNER_PHONE})
    assert res.status_code == 200
    assert res.json()["demo_code"] is None


# --- Reset: a real owner only, rate-limited ------------------------------------------


@pytest.mark.usefixtures("base_sample")
def test_reset_refused_for_the_demo_subject(hosted: TestClient) -> None:
    res = hosted.post("/demo/reset", headers=headers("demo"))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "reset_owner_only"


@pytest.mark.usefixtures("base_sample")
def test_reset_refused_for_an_account_not_in_owner_phones(
    hosted: TestClient, session: Session
) -> None:
    subject = add_account(session, phone="9700000001")
    res = hosted.post("/demo/reset", headers=headers(subject))
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "reset_owner_only"


@pytest.mark.usefixtures("base_sample")
def test_reset_for_the_owner_is_rate_limited(hosted: TestClient, session: Session) -> None:
    subject = add_account(session)
    assert hosted.post("/demo/reset", headers=headers(subject)).status_code == 200
    assert hosted.post("/demo/reset", headers=headers()).status_code == 200  # operator, no session
    third = hosted.post("/demo/reset", headers=headers(subject))
    assert third.status_code == 429


@pytest.mark.usefixtures("base_sample")
def test_reset_needs_the_token_even_for_an_owner_subject(
    hosted: TestClient, session: Session
) -> None:
    subject = add_account(session)
    res = hosted.post("/demo/reset", headers={"X-Seedha-Subject": subject})
    assert res.status_code == 403
    assert hosted.post("/demo/reset").status_code == 401


# --- No paid Claude calls or testnet writes for demo visitors ----------------------


def make_request(app: FastAPI, hdrs: dict[str, str], host: str = "127.0.0.1") -> Request:
    raw = [(k.lower().encode(), v.encode()) for k, v in hdrs.items()]
    return Request({"type": "http", "app": app, "client": (host, 1), "headers": raw})


@pytest.mark.usefixtures("base_sample")
def test_claude_off_for_demo_and_public_on_for_real_owner(
    prod_settings: Settings, factory: sessionmaker[Session], session: Session
) -> None:
    keyed = replace(prod_settings, anthropic_api_key=FAKE_KEY, claude_model="m")
    app = create_app(keyed, factory)
    owner = add_account(session)
    stranger = add_account(session, phone="9700000002")
    cases = [
        (headers("demo"), False),
        ({}, False),  # public routes (consent, link, site)
        (headers(), False),  # token, no session
        (headers(stranger), False),
        ({"X-Seedha-Subject": owner}, False),  # forged subject without the token
        (headers(owner), True),
    ]
    for hdrs, claude_on in cases:
        assert get_settings(make_request(app, hdrs)).llm_enabled is claude_on, hdrs
    flagged = create_app(replace(keyed, allow_claude_for_demo=True), factory)
    assert get_settings(make_request(flagged, headers("demo"))).llm_enabled


@pytest.mark.usefixtures("base_sample")
def test_accounts_off_means_no_owner_spending(
    prod_settings: Settings, factory: sessionmaker[Session], session: Session
) -> None:
    keyed = replace(prod_settings, anthropic_api_key=FAKE_KEY, claude_model="m",
                    allow_owner_accounts=False)  # fmt: skip
    app = create_app(keyed, factory)
    owner = add_account(session)
    assert not get_settings(make_request(app, headers(owner))).llm_enabled
    assert not chain_allowed(make_request(app, headers(owner)))


class NeverWriter:
    """Fails the test if anything tries to publish or check the chain."""

    def __getattr__(self, name: str) -> object:
        raise AssertionError(f"chain writer used: {name}")


@pytest.mark.usefixtures("base_sample")
def test_demo_proof_write_stays_local_unless_flagged(
    prod_settings: Settings, factory: sessionmaker[Session], session: Session
) -> None:
    app = create_app(prod_settings, factory)
    app.state.chain_writer = NeverWriter()
    with TestClient(app, client=RAILWAY_PROXY) as client:
        view = client.get("/proof", headers=headers("demo"))
        assert view.status_code == 200
        assert view.json()["chain"]["reason"] == "public_mode"
    owner = add_account(session)
    assert not chain_allowed(make_request(app, headers("demo")))
    assert chain_allowed(make_request(app, headers(owner)))
    flagged = create_app(replace(prod_settings, allow_demo_proof_writes=True), factory)
    assert chain_allowed(make_request(flagged, headers("demo")))


def test_printing_stays_open_but_limited_in_production(settings: Settings) -> None:
    limiter_app = create_app(prod(settings))
    request = make_request(limiter_app, {}, host="203.0.113.7")
    for _ in range(6):
        print_guarded(request)
    with pytest.raises(Exception, match="Too many prints"):
        print_guarded(request)


# --- The real client address behind the platform proxy ---------------------------


@pytest.mark.usefixtures("base_sample")
def test_forged_loopback_grants_nothing_behind_the_proxy(
    prod_settings: Settings, factory: sessionmaker[Session]
) -> None:
    """uvicorn --forwarded-allow-ips='*': the left-most X-Forwarded-For entry
    (what the web BFF set) becomes request.client. A direct caller can write
    127.0.0.1 there, and production still treats it as remote."""
    keyed = replace(prod_settings, anthropic_api_key=FAKE_KEY, claude_model="m")
    inner = create_app(keyed, factory)
    seen: list[str] = []

    @inner.get("/whoami")
    def whoami(request: Request) -> dict[str, bool]:
        seen.append(request.client.host if request.client else "")
        return {"claude": get_settings(request).llm_enabled}

    proxied = ProxyHeadersMiddleware(inner, trusted_hosts="*")  # type: ignore[arg-type]
    forged = {"X-Forwarded-For": "127.0.0.1, 198.51.100.4"}
    with TestClient(proxied, client=RAILWAY_PROXY) as client:  # type: ignore[arg-type]
        assert client.get("/whoami", headers=headers("demo") | forged).json() == {"claude": False}
        reset = client.post("/demo/reset", headers=headers("demo") | forged)
        assert reset.status_code == 403
        client.get("/whoami", headers={"X-Forwarded-For": "203.0.113.7, 10.250.0.9"})
    assert seen == ["127.0.0.1", "203.0.113.7"]


def test_each_guest_gets_their_own_rate_limit_bucket(
    prod_settings: Settings, factory: sessionmaker[Session]
) -> None:
    """Without trusting the proxy every guest would share the proxy's address."""
    proxied = ProxyHeadersMiddleware(
        create_app(prod_settings, factory),  # type: ignore[arg-type]
        trusted_hosts="*",
    )
    with TestClient(proxied, client=RAILWAY_PROXY) as client:  # type: ignore[arg-type]
        first = {"X-Forwarded-For": "203.0.113.7, 10.250.0.9"}
        codes = [client.get("/public/consent/nope", headers=first).status_code for _ in range(21)]
        assert codes[-1] == 429 and 429 not in codes[:-1]
        second = {"X-Forwarded-For": "203.0.113.8, 10.250.0.9"}
        assert client.get("/public/consent/nope", headers=second).status_code != 429


# --- app.main:app and the Railway files -------------------------------------------


def test_lazy_app_builds_on_first_request(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SEEDHA_ENV", raising=False)
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    lazy = LazyApp()
    with TestClient(lazy) as client:
        assert client.get("/health").json()["status"] == "ok"
    assert lazy.get() is lazy.get()


def test_lazy_app_fails_startup_on_unsafe_production(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SEEDHA_ENV", "production")
    monkeypatch.setenv("OWNER_API_TOKEN", sorted(PUBLISHED_DEMO_VALUES)[0])
    sent: list[MutableMapping[str, Any]] = []

    async def receive() -> dict[str, Any]:
        return {"type": "lifespan.startup"}

    async def send(message: MutableMapping[str, Any]) -> None:
        sent.append(message)

    asyncio.run(LazyApp()({"type": "lifespan", "asgi": {"version": "3.0"}}, receive, send))
    assert sent[0]["type"] == "lifespan.startup.failed"
    assert "SESSION_SECRET" in sent[0]["message"] or "OWNER_API_TOKEN" in sent[0]["message"]


def test_requirements_mirror_pyproject() -> None:
    deps = tomllib.loads((API_ROOT / "pyproject.toml").read_text())["project"]["dependencies"]
    lines = (API_ROOT / "requirements.txt").read_text().splitlines()
    assert [ln for ln in lines if ln and not ln.startswith("#")] == deps


def test_railway_config(settings: Settings) -> None:
    config = json.loads((API_ROOT / "railway.json").read_text())
    deploy = config["deploy"]
    start = deploy["startCommand"]
    assert start.startswith("alembic upgrade head && uvicorn app.main:app ")
    assert "--port $PORT" in start and "--forwarded-allow-ips='*'" in start
    paths = {getattr(r, "path", None) for r in create_app(settings).routes}
    assert deploy["healthcheckPath"] in paths
    assert (API_ROOT / ".python-version").read_text().strip() == "3.12"
    assert SimpleNamespace(**config).build["builder"] == "RAILPACK"
