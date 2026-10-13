"""Seedha API application factory."""

from __future__ import annotations

import logging
import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session, sessionmaker
from starlette.types import Message, Receive, Scope, Send

from app.body_limit import BodyLimitMiddleware
from app.config import ProductionConfigError, Settings, load_settings, production_problems
from app.db import make_engine, make_session_factory
from app.deps import OwnerDep, PropertyDep
from app.errors import install_error_handlers
from app.proxy_trust import ProxyTrustMiddleware
from app.ratelimit import RateLimiter
from app.routers import (
    ask,
    assistant,
    auth,
    calendar,
    card_page,
    desk,
    events,
    guest_feedback,
    inbox,
    invoice,
    ledger,
    link,
    messages,
    myplace,
    overview,
    pipeline,
    pro_views,
    proof,
    public,
    public_sample,
    public_site,
    ratings,
    repeat,
    rooms,
    scenario,
    site,
    site_build,
    site_details,
    statements,
    webhooks,
)
from app.routers import settings as owner_settings

logger = logging.getLogger("seedha")


class HealthOut(BaseModel):
    """Liveness plus which integrations are real and which are simulated."""

    status: str
    llm: str
    whatsapp: str
    payments: str
    proof_chain: str


class PropertyOut(BaseModel):
    """What the app shell shows about the hotel."""

    name: str
    short_name: str
    city: str
    address: str
    rooms_count: int
    owner_name: str
    is_sample: bool


def _mode(enabled: bool) -> str:
    return "live" if enabled else "simulated"


def allowed_origins(settings: Settings) -> list[str]:
    """CORS allow-list. Local: the web origin, as always. Production: the
    checked https list from PUBLIC_BASE_URL and WEB_ORIGIN; refuses to start
    on any unsafe setting, logging the variable's name but never its value."""
    if not settings.production:
        return [settings.web_origin]
    problems = production_problems(settings)
    for name, problem in problems:
        logger.error("Refusing to start in production: %s %s", name, problem)
    if problems:
        name, problem = problems[0]
        raise ProductionConfigError(f"{name} {problem}")
    logger.warning(
        "PRODUCTION mode: sample hotel only; Claude %s and testnet proofs %s for the demo",
        "on" if settings.allow_claude_for_demo else "off",
        "on" if settings.allow_demo_proof_writes else "off",
    )
    return list(settings.cors_origins)


def create_app(
    settings: Settings | None = None,
    session_factory: sessionmaker[Session] | None = None,
) -> FastAPI:
    """Build the app. Tests pass their own settings and session factory."""
    settings = settings or load_settings()
    origins = allowed_origins(settings)
    if session_factory is None:
        session_factory = make_session_factory(make_engine(settings.database_url))
    # Production: no public API docs (hosting security review S-H2).
    hide_docs = settings.production
    api = FastAPI(
        title="Seedha API",
        version="0.1.0",
        docs_url=None if hide_docs else "/docs",
        redoc_url=None if hide_docs else "/redoc",
        openapi_url=None if hide_docs else "/openapi.json",
    )
    api.state.settings = settings
    api.state.session_factory = session_factory
    api.state.rate_limiter = RateLimiter()
    api.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Device-Key"],
    )
    if settings.production:
        api.add_middleware(ProxyTrustMiddleware, owner_token=settings.owner_api_token)
    # Added last, so it runs first: oversized bodies never reach a route (V1-M1).
    api.add_middleware(BodyLimitMiddleware)
    install_error_handlers(api)
    for name, enabled in (
        ("LLM", settings.llm_enabled),
        ("WhatsApp", settings.whatsapp_enabled),
        # No payment gateway is connected yet: UPI is always simulated, keys or not.
        ("Payments", False),
        ("Proof chain", settings.chain_enabled),
    ):
        if not enabled:
            logger.warning("%s keys missing: running in SIMULATED mode", name)

    @api.get("/health", response_model=HealthOut)
    def health() -> HealthOut:
        return HealthOut(
            status="ok",
            llm=_mode(settings.llm_enabled),
            whatsapp=_mode(settings.whatsapp_enabled),
            payments=_mode(False),
            proof_chain=_mode(settings.chain_enabled),
        )

    @api.get("/property", response_model=PropertyOut)
    def get_property_info(_owner: OwnerDep, prop: PropertyDep) -> PropertyOut:
        return PropertyOut.model_validate(prop, from_attributes=True)

    for router in (
        auth.router,
        pipeline.router,
        overview.router,
        rooms.router,
        statements.router,
        ledger.router,
        repeat.router,
        scenario.router,
        desk.router,
        public.router,
        public_sample.router,
        messages.router,
        webhooks.router,
        link.public_router,
        link.savings_router,
        proof.router,
        ask.router,
        inbox.router,
        invoice.router,
        assistant.router,
        site.site_router,
        site_build.router,
        site_details.router,
        site.pro_router,
        pro_views.router,
        site.demo_router,
        public_site.router,
        ratings.router,
        card_page.router,
        guest_feedback.router,
        owner_settings.router,
        calendar.router,
        events.router,
        myplace.router,
    ):
        api.include_router(router)
    return api


class LazyApp:
    """`uvicorn app.main:app`: builds the app on first use, not at import, so
    importing this module (tests, alembic, the seed CLI) has no side effects.
    A production refusal fails the lifespan startup, so uvicorn exits.
    `uvicorn --factory app.main:create_app` (the Makefile) works as before."""

    def __init__(self) -> None:
        self._app: FastAPI | None = None
        self._lock = threading.Lock()

    def get(self) -> FastAPI:
        """The real app, built once."""
        with self._lock:
            if self._app is None:
                self._app = create_app()
            return self._app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "lifespan":
            await self.get()(scope, receive, send)
            return
        first = await receive()  # lifespan.startup
        try:
            inner = self.get()
        except ProductionConfigError as exc:
            await send({"type": "lifespan.startup.failed", "message": str(exc)})
            return
        replayed = False

        async def replay() -> Message:
            nonlocal replayed
            if not replayed:
                replayed = True
                return first
            return await receive()

        await inner(scope, replay, send)


app = LazyApp()
