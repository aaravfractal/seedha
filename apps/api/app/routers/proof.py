"""Seedha Proof: consent fingerprints, nightly bundles, per-consent checks."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Request
from pydantic import BaseModel
from sqlalchemy import select

from app.config import Settings
from app.deps import OwnerDep, PropertyDep, SessionDep, SettingsDep
from app.errors import ApiError
from app.models import Booking, Consent, ProofBundle
from app.public_mode import is_remote_public
from app.services.chain import (
    EXPLORER_TX,
    NETWORK_LABEL,
    AmoyWriter,
    ChainStatus,
    Mode,
    Reason,
    local_status,
    writer_for,
)
from app.services.consent import as_utc
from app.services.desk import month_start, utc_now
from app.services.proof import (
    Entry,
    LocalOnly,
    ProofError,
    bundle_entries,
    consent_proof,
    pending_consents,
    publish_bundle,
    recheck_sent,
)

router = APIRouter(prefix="/proof", tags=["proof"])
RECHECK_TIMEOUT_S = 3.0


class BundleOut(BaseModel):
    """One nightly bundle. Only hashes: no personal data (rule 9)."""

    id: int
    created_at: datetime
    item_count: int
    merkle_root: str
    chain_status: str
    chain_tx: str | None
    chain_block: int | None
    network_label: str | None
    explorer_url: str | None


class ChainOut(BaseModel):
    """The proof wallet. Testnet only; public address, never the key."""

    mode: Mode
    network_label: str
    address: str | None
    balance_pol: str | None
    low_balance: bool
    reason: Reason | None
    address_url: str | None


class EntryOut(BaseModel):
    """One consent in a bundle (bundle_id) or waiting for tonight's (None).

    The guest's name is for the owner's screen only and never part of a
    bundle; an erased entry has no name or time left.
    """

    bundle_id: int | None
    consent_id: int | None
    guest_name: str | None
    given_at: datetime | None
    status: str


class ProofOut(BaseModel):
    """Proof overview."""

    consents_this_month: int
    proven: int
    pending: int
    sealed: int
    mismatches: int
    chain_live: bool
    chain: ChainOut
    bundles: list[BundleOut]
    entries: list[EntryOut]


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
        chain_status=b.chain_status, chain_tx=b.chain_tx, chain_block=b.chain_block,
        network_label=NETWORK_LABEL if b.chain_tx else None,
        explorer_url=f"{EXPLORER_TX}{b.chain_tx}" if b.chain_tx else None,
    )  # fmt: skip


def entry_out(bundle_id: int | None, entry: Entry) -> EntryOut:
    """Shape one entry."""
    c = entry.consent
    if c is None:
        return EntryOut(bundle_id=bundle_id, consent_id=None, guest_name=None, given_at=None,
                        status=entry.status)  # fmt: skip
    return EntryOut(bundle_id=bundle_id, consent_id=c.id, guest_name=c.guest.display_name,
                    given_at=c.given_at, status=entry.status)  # fmt: skip


def chain_out(status: ChainStatus) -> ChainOut:
    """Shape the wallet status."""
    return ChainOut(
        mode=status.mode, network_label=NETWORK_LABEL, address=status.address,
        balance_pol=status.balance_pol, low_balance=status.low_balance, reason=status.reason,
        address_url=status.address_url,
    )  # fmt: skip


# What a public-demo visitor sees: testnet writes run only on the laptop.
PUBLIC_LOCAL = ChainStatus("local", None, None, False, False, "public_mode")


def chain_writer(request: Request, settings: Settings) -> AmoyWriter | None:
    """One writer per app (it holds the nonce lock and the status cache)."""
    state = request.app.state
    if not hasattr(state, "chain_writer"):
        state.chain_writer = writer_for(settings)
    writer: AmoyWriter | None = state.chain_writer
    return writer


def chain_status(writer: AmoyWriter | None, settings: Settings) -> ChainStatus:
    """Cached wallet status, or why the chain is off."""
    return writer.status() if writer else local_status(settings)


def overview(session: SessionDep, property_id: int, chain: ChainStatus) -> ProofOut:
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
    sealed = [entry_out(b.id, e) for b in bundles for e in bundle_entries(session, b)]
    pending = [entry_out(None, Entry(c, "pending")) for c in pending_consents(session, property_id)]
    return ProofOut(
        consents_this_month=sum(1 for c in rows if as_utc(c.given_at) >= since),
        proven=sum(1 for c in rows if c.proof_status == "verified"),
        pending=sum(1 for c in rows if c.proof_status == "pending"),
        sealed=sum(b.item_count for b in bundles),
        mismatches=sum(1 for e in sealed if e.status == "mismatch"),
        chain_live=chain.mode == "amoy",
        chain=chain_out(chain),
        bundles=[bundle_out(b) for b in bundles],
        entries=pending + sealed,
    )


@router.get("", response_model=ProofOut)
def get_proof(
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    settings: SettingsDep,
    request: Request,
) -> ProofOut:
    """Proof overview. Bundles still waiting on the testnet get one quick
    receipt check, skipped while the RPC is known to be down."""
    if is_remote_public(request):
        return overview(session, prop.id, PUBLIC_LOCAL)
    writer = chain_writer(request, settings)
    status = chain_status(writer, settings)
    if writer and status.reachable and status.reason != "wrong_chain":
        recheck_sent(session, prop.id, writer, RECHECK_TIMEOUT_S)
    return overview(session, prop.id, status)


@router.post("/bundle", response_model=ProofOut)
def write_tonight(
    _owner: OwnerDep,
    session: SessionDep,
    prop: PropertyDep,
    settings: SettingsDep,
    request: Request,
) -> ProofOut:
    """Write tonight's proof now (the nightly job does the same). With a
    configured wallet the root also goes to Polygon Amoy; any refusal keeps
    it local and is reported in `chain.reason`. A public-demo visitor's write
    stays local, so nobody else can spend the testnet wallet."""
    if is_remote_public(request):
        try:
            publish_bundle(session, prop.id, LocalOnly("public_mode"), utc_now())
        except ProofError as exc:
            raise ApiError(exc.status, exc.code, exc.message) from exc
        return overview(session, prop.id, PUBLIC_LOCAL)
    writer = chain_writer(request, settings)
    chain = writer or LocalOnly(local_status(settings).reason or "no_key")
    try:
        publish_bundle(session, prop.id, chain, utc_now())
    except ProofError as exc:
        raise ApiError(exc.status, exc.code, exc.message) from exc
    return overview(session, prop.id, chain_status(writer, settings))


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
        status="mismatch" if proof.matches is False else c.proof_status,
        bundle=bundle_out(proof.bundle) if proof.bundle else None,
        path=[PathStepOut(side=side, hash=h) for side, h in proof.path],
        matches=proof.matches,
    )
