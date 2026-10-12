"""Hotel site addresses (docs/SITE_REAL.md section 5).

A slug is the hotel's address: <slug>.<SITE_ROOT_DOMAIN> when a root domain
is set, else <app origin>/h/<slug>. Rules: lowercase letters, numbers and
single hyphens, 3 to 40 characters, unique across properties, never a
reserved word (app hosts and the web app's own route names). Renaming keeps
the old slug for 30 days, during which it redirects to the new one and
nobody else may take it; after that it frees up.

The sample hotel is always public (rule 11 labels it); until its owner picks
an address it lives at the slug of its short name ("deodar-view").
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models import Property, SiteConfig
from app.services.site import is_public, slugify

MIN_LENGTH, MAX_LENGTH = 3, 40
REDIRECT_DAYS = 30
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
# App hosts, mail and infrastructure names, and every top-level route of the
# web app (apps/web/app), so <slug>.<root> and /h/<slug> never shadow them.
RESERVED = frozenset(
    {
        "www", "app", "api", "admin", "mail", "docs", "status",
        "hotel", "h", "login", "static", "signup", "otp", "onboard", "demo",
        "home", "upload", "flip", "repeat", "scenario", "approvals", "savings",
        "ask", "site", "proof", "pro", "settings", "desk", "rate-card",
        "agent-deck", "my-place", "inbox", "assistant", "calendar", "billing",
        "consent", "link", "plans", "about", "careers", "contact", "cookies",
        "data-deletion", "faq", "privacy", "security", "terms", "auth",
        "session", "public", "health", "webhooks", "not-live", "seedha",
        "help", "support", "blog", "cdn", "assets", "img", "images", "ftp",
        "smtp", "imap", "pop", "dev", "staging", "test", "localhost",
    }
)  # fmt: skip

SlugProblem = Literal["slug_invalid", "slug_reserved", "slug_taken"]
State = Literal["live", "moved", "none"]


def shape_problem(slug: str) -> SlugProblem | None:
    """Why this slug can never be used, regardless of who holds it."""
    if not MIN_LENGTH <= len(slug) <= MAX_LENGTH or not SLUG_PATTERN.fullmatch(slug):
        return "slug_invalid"
    if slug in RESERVED:
        return "slug_reserved"
    return None


def aware(moment: datetime) -> datetime:
    """SQLite returns naive datetimes; they are stored in UTC."""
    return moment if moment.tzinfo else moment.replace(tzinfo=UTC)


def redirect_active(config: SiteConfig, now: datetime) -> bool:
    """The previous slug still redirects (and stays held) for 30 days."""
    if config.previous_slug is None or config.slug_changed_at is None:
        return False
    return now - aware(config.slug_changed_at) < timedelta(days=REDIRECT_DAYS)


def current_slug(prop: Property, config: SiteConfig) -> str | None:
    """The slug the site lives at now: the stored one, or the sample hotel's default."""
    if config.slug:
        return config.slug
    return slugify(prop.short_name) if prop.is_sample else None


def held_by_other(session: Session, slug: str, property_id: int, now: datetime) -> bool:
    """Whether another property uses this slug now or holds it for a redirect."""
    rows = session.execute(
        select(Property, SiteConfig)
        .outerjoin(SiteConfig, SiteConfig.property_id == Property.id)
        .where(Property.id != property_id)
    ).all()
    for prop, config in rows:
        if config is None:
            if prop.is_sample and slugify(prop.short_name) == slug:
                return True
            continue
        if current_slug(prop, config) == slug:
            return True
        if config.previous_slug == slug and redirect_active(config, now):
            return True
    return False


def problem(session: Session, slug: str, property_id: int, now: datetime) -> SlugProblem | None:
    """Why this property may not take this slug, or None when it may."""
    return shape_problem(slug) or (
        "slug_taken" if held_by_other(session, slug, property_id, now) else None
    )


def suggested_slug(session: Session, prop: Property, config: SiteConfig, now: datetime) -> str:
    """The address to prefill: the current one, else the hotel name made unique (-2, -3...)."""
    existing = current_slug(prop, config)
    if existing and problem(session, existing, prop.id, now) is None:
        return existing
    base = slugify(prop.short_name or prop.name)[:MAX_LENGTH].strip("-")
    if shape_problem(base) is not None:
        base = f"{base}-hotel".strip("-") if base else "my-hotel"
        base = base[:MAX_LENGTH].strip("-")
    if shape_problem(base) is not None:  # pragma: no cover - "<x>-hotel" is always valid
        base = "my-hotel"
    candidate, n = base, 2
    while problem(session, candidate, prop.id, now) is not None:
        suffix = f"-{n}"
        candidate = f"{base[: MAX_LENGTH - len(suffix)].strip('-')}{suffix}"
        n += 1
    return candidate


def set_slug(prop: Property, config: SiteConfig, slug: str, now: datetime) -> None:
    """Give the site its address. A rename keeps the old slug to redirect for 30 days."""
    old = current_slug(prop, config)
    if old == slug:
        config.slug = slug
        return
    if old is not None:
        config.previous_slug = old
        config.slug_changed_at = now
    config.slug = slug


@dataclass(frozen=True, slots=True)
class Resolved:
    """Where a slug leads: a live site, a renamed one (new slug), or nothing."""

    state: State
    slug: str
    prop: Property | None = None


def resolve(session: Session, slug: str, now: datetime) -> Resolved:
    """Live when a public site uses this slug; moved within 30 days of a rename."""
    slug = slug.lower()
    if shape_problem(slug) is not None:
        return Resolved("none", slug)
    rows = session.execute(
        select(Property, SiteConfig)
        .outerjoin(SiteConfig, SiteConfig.property_id == Property.id)
        .where(
            or_(
                SiteConfig.slug == slug,
                SiteConfig.previous_slug == slug,
                SiteConfig.id.is_(None),
                SiteConfig.slug.is_(None),
            )
        )
        .order_by(Property.id)
    ).all()
    moved: Resolved | None = None
    for prop, config in rows:
        cfg = config or SiteConfig(property_id=prop.id)
        if current_slug(prop, cfg) == slug:
            if is_public(prop, cfg):
                return Resolved("live", slug, prop)
            continue
        new = current_slug(prop, cfg)
        if cfg.previous_slug == slug and redirect_active(cfg, now) and new and is_public(prop, cfg):
            moved = moved or Resolved("moved", new, prop)
    return moved or Resolved("none", slug)


def site_url(slug: str, web_origin: str, root: str) -> str:
    """https://<slug>.<root> when a root domain is set, else <app origin>/h/<slug>."""
    if root:
        return f"https://{slug}.{root}"
    return f"{web_origin.rstrip('/')}/h/{slug}"


def display_address(url: str) -> str:
    """The address as people read it: no scheme ('deodar-view.seedha.in')."""
    return url.removeprefix("https://").removeprefix("http://")
