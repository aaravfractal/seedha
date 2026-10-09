"""Seedha API application factory."""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session, sessionmaker

from app.config import Settings, load_settings
from app.db import make_engine, make_session_factory
from app.deps import OwnerDep, PropertyDep
from app.errors import install_error_handlers
from app.ratelimit import RateLimiter
from app.routers import (
    ask,
    desk,
    ledger,
    link,
    messages,
    pipeline,
    proof,
    public,
    repeat,
    scenario,
    site,
    statements,
    webhooks,
)

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


def create_app(
    settings: Settings | None = None,
    session_factory: sessionmaker[Session] | None = None,
) -> FastAPI:
    """Build the app. Tests pass their own settings and session factory."""
    settings = settings or load_settings()
    if session_factory is None:
        session_factory = make_session_factory(make_engine(settings.database_url))
    app = FastAPI(title="Seedha API", version="0.1.0")
    app.state.settings = settings
    app.state.session_factory = session_factory
    app.state.rate_limiter = RateLimiter()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.web_origin],
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Device-Key"],
    )
    install_error_handlers(app)
    for name, enabled in (
        ("LLM", settings.llm_enabled),
        ("WhatsApp", settings.whatsapp_enabled),
        ("Payments", settings.razorpay_enabled),
        ("Proof chain", settings.chain_enabled),
    ):
        if not enabled:
            logger.warning("%s keys missing: running in SIMULATED mode", name)

    @app.get("/health", response_model=HealthOut)
    def health() -> HealthOut:
        return HealthOut(
            status="ok",
            llm=_mode(settings.llm_enabled),
            whatsapp=_mode(settings.whatsapp_enabled),
            payments=_mode(settings.razorpay_enabled),
            proof_chain=_mode(settings.chain_enabled),
        )

    @app.get("/property", response_model=PropertyOut)
    def get_property_info(_owner: OwnerDep, prop: PropertyDep) -> PropertyOut:
        return PropertyOut.model_validate(prop, from_attributes=True)

    app.include_router(pipeline.router)
    app.include_router(statements.router)
    app.include_router(ledger.router)
    app.include_router(repeat.router)
    app.include_router(scenario.router)
    app.include_router(desk.router)
    app.include_router(public.router)
    app.include_router(messages.router)
    app.include_router(webhooks.router)
    app.include_router(link.public_router)
    app.include_router(link.savings_router)
    app.include_router(proof.router)
    app.include_router(ask.router)
    app.include_router(site.site_router)
    app.include_router(site.pro_router)
    app.include_router(site.demo_router)
    return app
