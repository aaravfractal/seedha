"""Runtime settings read from the environment (.env is loaded by the Makefile).

Rule 10: secrets live in .env only. Nothing here has a real secret default;
every external service is optional and falls back to a simulated mode.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from datetime import date
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = API_ROOT / "seedha.db"


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


@dataclass(frozen=True, slots=True)
class Settings:
    """Typed view of the environment. Empty string means "not configured"."""

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
    proof_private_key: str
    demo_date: date | None
    desk_device_key: str

    @property
    def llm_enabled(self) -> bool:
        """Claude is called only when a key and model are both set."""
        return bool(self.anthropic_api_key and self.claude_model)

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
        """Testnet writes need an RPC URL and a key; otherwise roots stay local."""
        return bool(self.proof_rpc_url and self.proof_private_key)


def load_settings() -> Settings:
    """Read settings from the process environment."""
    raw_demo_date = _env("DEMO_DATE")
    return Settings(
        database_url=_env("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}"),
        owner_api_token=_env("OWNER_API_TOKEN"),
        web_origin=_env("WEB_ORIGIN", "http://localhost:3000"),
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
    )
