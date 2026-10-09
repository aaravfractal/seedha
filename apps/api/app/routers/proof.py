"""Seedha Proof: consent fingerprints, nightly bundles, per-consent checks."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app.deps import OwnerDep, PropertyDep, SessionDep, SettingsDep
from app.errors import ApiError
from app.models import Booking, Consent, ProofBundle
from app.services.consent import as_utc
from app.services.desk import month_start, utc_now
from app.services.proof import LocalOnly, ProofError, consent_proof, write_bundle

router = APIRouter(prefix="/proof", tags=["proof"])
EXPLORER_TX = "https://amoy.polygonscan.com/tx/"


class BundleOut(BaseModel):
    """One nightly bundle. Only hashes: no personal data (rule 9)."""

    id: int
    created_at: datetime
    item_count: int
    merkle_root: str
    chain_status: str
    chain_tx: str | None
    explorer_url: str | None


class ProofOut(BaseModel):
    """Proof overview."""

    consents_this_month: int
    proven: int
    pending: int
    chain_live: bool
    bundles: list[BundleOut]


class PathStepOut(BaseModel):
    """One sibling hash on the way from a fingerprint to the root."""

    side: str
    hash: str


class ConsentProofOut(BaseModel):
    """What the proof dialog shows for one consent."""

    consent_id: int
    guest_name: str
    given_at: datetime
    fingerprint: str
    status: str
    bundle: BundleOut | None
    path: list[PathStepOut]
    matches: bool | None


def bundle_out(b: ProofBundle) -> BundleOut:
    """Shape a bundle."""
    return BundleOut(
        id=b.id, created_at=b.created_at, item_count=b.item_count, merkle_root=b.merkle_root,
        chain_status=b.chain_status, chain_tx=b.chain_tx,
        explorer_url=f"{EXPLORER_TX}{b.chain_tx}" if b.chain_tx else None,
    )  # fmt: skip


def overview(session: SessionDep, property_id: int, chain_live: bool) -> ProofOut:
    """Counts and bundles, newest first."""
    consents = (
        select(Consent)
        .join(Booking, Booking.id == Consent.booking_id)
        .where(Booking.property_id == property_id, Consent.erased_at.is_(None))
    )
    rows = session.scalars(consents).all()
    since = month_start(utc_now().date())
    bundles = session.scalars(
        select(ProofBundle)
        .where(ProofBundle.property_id == property_id)
        .order_by(ProofBundle.id.desc())
    ).all()
    return ProofOut(
        consents_this_month=sum(1 for c in rows if as_utc(c.given_at) >= since),
        proven=sum(1 for c in rows if c.proof_status == "verified"),
        pending=sum(1 for c in rows if c.proof_status == "pending"),
        chain_live=chain_live,
        bundles=[bundle_out(b) for b in bundles],
    )


@router.get("", response_model=ProofOut)
def get_proof(
    _owner: OwnerDep, session: SessionDep, prop: PropertyDep, settings: SettingsDep
) -> ProofOut:
    """Proof overview."""
    return overview(session, prop.id, settings.chain_enabled)


@router.post("/bundle", response_model=ProofOut)
def write_tonight(
    _owner: OwnerDep, session: SessionDep, prop: PropertyDep, settings: SettingsDep
) -> ProofOut:
    """Write tonight's proof now (the nightly job does the same)."""
    try:
        write_bundle(session, prop.id, LocalOnly(), utc_now())
    except ProofError as exc:
        raise ApiError(exc.status, exc.code, exc.message) from exc
    return overview(session, prop.id, settings.chain_enabled)


@router.get("/consents/{consent_id}", response_model=ConsentProofOut)
def get_consent_proof(
    consent_id: int, _owner: OwnerDep, session: SessionDep, prop: PropertyDep
) -> ConsentProofOut:
    """One consent's proof, re-verified against its bundle's root right now."""
    try:
        proof = consent_proof(session, prop.id, consent_id)
    except ProofError as exc:
        raise ApiError(exc.status, exc.code, exc.message) from exc
    c = proof.consent
    return ConsentProofOut(
        consent_id=c.id,
        guest_name=c.guest.display_name,
        given_at=c.given_at,
        fingerprint=c.fingerprint,
        status=c.proof_status,
        bundle=bundle_out(proof.bundle) if proof.bundle else None,
        path=[PathStepOut(side=side, hash=h) for side, h in proof.path],
        matches=proof.matches,
    )
