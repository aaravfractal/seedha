"""Runtime settings read from the environment (.env is loaded by the Makefile).

Rule 10: secrets live in .env only. Nothing here has a real secret default;
every external service is optional and falls back to a simulated mode.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = API_ROOT / "seedha.db"
AMOY_CHAIN_ID = "80002"
PRODUCTION = "production"
MIN_SECRET_LENGTH = 32
DEFAULT_SITE_GEN_TOKEN_CAP = 300_000
# The values published in .env.example. Never accepted in production.
PUBLISHED_DEMO_VALUES = frozenset(
    {
        "demo-owner-token-change-me",
        "demo-session-secret-change-me-32chars",
        "demo-desk-key-change-me",
    }
)


class ProductionConfigError(RuntimeError):
    """SEEDHA_ENV=production with an unsafe setting. Names the variable only."""


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _flag(name: str) -> bool:
    return _env(name) == "1"


def _count(name: str, default: int) -> int:
    """A non-negative whole number from the environment, else `default`."""
    raw = _env(name)
    return int(raw) if raw.isdigit() else default


def _origins(*raw: str) -> tuple[str, ...]:
    """Comma-separated origins, trailing slashes dropped, duplicates removed."""
    found = (o.strip().rstrip("/") for value in raw for o in value.split(","))
    return tuple(dict.fromkeys(o for o in found if o))


@dataclass(frozen=True, slots=True)
class Settings:  # pylint: disable=too-many-instance-attributes
    """Typed view of the environment (one field per variable). Empty string means
    "not configured"."""

    database_url: str
    owner_api_token: str
    web_origin: str
    anthropic_api_key: str
    claude_model: str
    whatsapp_token: str
    whatsapp_phone_number_id: str
    whatsapp_verify_token: str
    whatsapp_app_secret: str
    whatsapp_api_version: str
    razorpay_key_id: str
    razorpay_key_secret: str
    proof_rpc_url: str
    # Never in repr, logs or tracebacks: the dataclass repr skips this field.
    proof_private_key: str = field(repr=False)
    demo_date: date | None
    desk_device_key: str
    # SEEDHA_DEMO=1: the simulated OTP sender returns the code to the web app,
    # which shows it in a labelled demo banner. Local demo only.
    seedha_demo: bool = False
    # Owner WhatsApp numbers (10 digits, comma-separated) allowed to run a
    # property that is not sample data. The sample hotel is open to any
    # signed-in session (all of its data is fictional).
    owner_phones: frozenset[str] = frozenset()
    # Polygon Amoy only: anything other than "80002" keeps proofs local.
    proof_chain_id: str = ""
    # --- Hosted deployment (SEEDHA_ENV=production); all off by default -------
    production: bool = False
    # Read only to check it in production; the web app signs cookies with it.
    session_secret: str = field(default="", repr=False)
    # CORS allow-list in production (PUBLIC_BASE_URL and WEB_ORIGIN, comma lists).
    cors_origins: tuple[str, ...] = ()
    # Production: OTP sign in and sign up for real owner accounts (default off:
    # the hosted demo offers the sample hotel through Direct beta login only).
    allow_owner_accounts: bool = False
    # Production: let demo and public visitors use Claude / write testnet proofs.
    allow_claude_for_demo: bool = False
    allow_demo_proof_writes: bool = False
    # Seedha Site generation (docs/SITE_REAL.md section 2). Empty model = the
    # labelled sample flow, no Claude call. Suggested: claude-haiku-5-5.
    site_gen_model: str = ""
    # Input + output + cache tokens per calendar month across the account.
    site_gen_monthly_token_cap: int = DEFAULT_SITE_GEN_TOKEN_CAP
    # Hotel addresses: <slug>.<SITE_ROOT_DOMAIN> when set, else <web>/h/<slug>.
    site_root_domain: str = ""
    # PUBLIC_BASE_URL alone (first entry); empty when not set. Card QR codes
    # point at <PUBLIC_BASE_URL>/h/<slug> (hotel mini-site).
    public_base_url: str = ""

    @property
    def llm_enabled(self) -> bool:
        """Claude is called only when a key and model are both set."""
        return bool(self.anthropic_api_key and self.claude_model)

    @property
    def site_gen_enabled(self) -> bool:
        """Site generation calls Claude only with a key and SITE_GEN_MODEL."""
        return bool(self.anthropic_api_key and self.site_gen_model)

    @property
    def whatsapp_enabled(self) -> bool:
        """Real WhatsApp sends need a token and a phone number id."""
        return bool(self.whatsapp_token and self.whatsapp_phone_number_id)

    @property
    def razorpay_enabled(self) -> bool:
        """Razorpay test mode needs both keys; otherwise UPI is simulated."""
        return bool(self.razorpay_key_id and self.razorpay_key_secret)

    @property
    def chain_enabled(self) -> bool:
        """Testnet writes need an RPC URL, a key and chain ID 80002 (Polygon
        Amoy); otherwise roots stay local."""
        return bool(
            self.proof_rpc_url and self.proof_private_key and self.proof_chain_id == AMOY_CHAIN_ID
        )


def production_problems(settings: Settings) -> list[tuple[str, str]]:
    """Why production may not start: (variable name, problem). Never a value."""
    problems: list[tuple[str, str]] = []
    for name, value in (
        ("SESSION_SECRET", settings.session_secret),
        ("OWNER_API_TOKEN", settings.owner_api_token),
        ("DESK_DEVICE_KEY", settings.desk_device_key),
    ):
        if not value:
            problems.append((name, "is not set"))
        elif value in PUBLISHED_DEMO_VALUES or "change-me" in value.lower():
            problems.append((name, "is the published demo value from .env.example"))
        elif len(value) < MIN_SECRET_LENGTH:
            problems.append((name, f"is shorter than {MIN_SECRET_LENGTH} characters"))
    if not settings.cors_origins:
        problems.append(("WEB_ORIGIN", "must list the web app's https origin"))
    elif any(not o.startswith("https://") or "*" in o for o in settings.cors_origins):
        problems.append(("WEB_ORIGIN", "must be https origins only, never a wildcard"))
    if settings.database_url.startswith("sqlite"):
        problems.append(("DATABASE_URL", "must point to Postgres, not SQLite"))
    return problems


def root_domain(raw: str) -> str:
    """'https://Seedha.in/' -> 'seedha.in': lower case, no scheme, path or end dots."""
    host = raw.strip().lower().removeprefix("https://").removeprefix("http://")
    return host.split("/")[0].split(":")[0].strip(".")


def load_settings() -> Settings:
    """Read settings from the process environment."""
    raw_demo_date = _env("DEMO_DATE")
    production = _env("SEEDHA_ENV") == PRODUCTION
    return Settings(
        database_url=_env("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}"),
        owner_api_token=_env("OWNER_API_TOKEN"),
        # PUBLIC_BASE_URL (demo-lan, demo-live) wins, so every QR and guest link
        # uses the address a phone can reach. Read at start-up, not at build time.
        # A comma list (production CORS) uses its first entry for links.
        web_origin=(_env("PUBLIC_BASE_URL") or _env("WEB_ORIGIN", "http://localhost:3000"))
        .split(",")[0]
        .strip(),
        anthropic_api_key=_env("ANTHROPIC_API_KEY"),
        claude_model=_env("CLAUDE_MODEL"),
        whatsapp_token=_env("WHATSAPP_TOKEN"),
        whatsapp_phone_number_id=_env("WHATSAPP_PHONE_NUMBER_ID"),
        whatsapp_verify_token=_env("WHATSAPP_VERIFY_TOKEN"),
        whatsapp_app_secret=_env("WHATSAPP_APP_SECRET"),
        whatsapp_api_version=_env("WHATSAPP_API_VERSION", "v21.0"),
        razorpay_key_id=_env("RAZORPAY_KEY_ID"),
        razorpay_key_secret=_env("RAZORPAY_KEY_SECRET"),
        proof_rpc_url=_env("PROOF_RPC_URL"),
        proof_private_key=_env("PROOF_PRIVATE_KEY"),
        demo_date=date.fromisoformat(raw_demo_date) if raw_demo_date else None,
        desk_device_key=_env("DESK_DEVICE_KEY"),
        # Never in production: the OTP code would be shown to anyone.
        seedha_demo=_flag("SEEDHA_DEMO") and not production,
        proof_chain_id=_env("PROOF_CHAIN_ID"),
        owner_phones=frozenset(
            p.strip()[-10:] for p in _env("OWNER_PHONES").split(",") if p.strip()
        ),
        production=production,
        session_secret=_env("SESSION_SECRET"),
        cors_origins=_origins(_env("PUBLIC_BASE_URL"), _env("WEB_ORIGIN")),
        allow_owner_accounts=_flag("ALLOW_OWNER_ACCOUNTS"),
        allow_claude_for_demo=_flag("ALLOW_CLAUDE_FOR_DEMO"),
        allow_demo_proof_writes=_flag("ALLOW_DEMO_PROOF_WRITES"),
        site_gen_model=_env("SITE_GEN_MODEL"),
        site_gen_monthly_token_cap=_count("SITE_GEN_MONTHLY_TOKEN_CAP", DEFAULT_SITE_GEN_TOKEN_CAP),
        site_root_domain=root_domain(_env("SITE_ROOT_DOMAIN")),
        public_base_url=_env("PUBLIC_BASE_URL").split(",")[0].strip(),
    )
