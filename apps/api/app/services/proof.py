"""Seedha Proof: consent fingerprints bundled under a nightly Merkle root.

Rule 9: only salted SHA-256 fingerprints are ever published; no name, phone
or booking detail. Erasure removes the salt and the number and cuts the link
from the published fingerprint to the guest, so the proof stays valid but can
no longer be tied to anyone.

Tree: leaf = SHA-256(fingerprint bytes); parent = SHA-256(left || right); an
odd node is paired with itself. A proof path is the list of sibling hashes
with their side, from leaf to root.
"""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models import Booking, Consent, Message, ProofBundle, ProofBundleItem
from app.services.consent import as_utc, fingerprint


class ProofError(ValueError):
    """Nothing to bundle, or an unknown consent."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


def _sha(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def leaf_hash(fingerprint: str) -> bytes:
    """Hash of one fingerprint (hex) as a tree leaf."""
    return _sha(bytes.fromhex(fingerprint))


def _next_level(level: list[bytes]) -> list[bytes]:
    if len(level) % 2:
        level = [*level, level[-1]]
    return [_sha(level[i] + level[i + 1]) for i in range(0, len(level), 2)]


def merkle_root(fingerprints: list[str]) -> str:
    """Root over the fingerprints, in the given order."""
    if not fingerprints:
        raise ProofError(409, "nothing_pending", "Nothing new to prove tonight")
    level = [leaf_hash(fp) for fp in fingerprints]
    while len(level) > 1:
        level = _next_level(level)
    return level[0].hex()


def merkle_path(fingerprints: list[str], index: int) -> list[tuple[str, str]]:
    """Sibling hashes ('left'|'right', hex) from leaf `index` up to the root."""
    level = [leaf_hash(fp) for fp in fingerprints]
    path: list[tuple[str, str]] = []
    while len(level) > 1:
        padded = [*level, level[-1]] if len(level) % 2 else level
        sibling = index ^ 1
        path.append(("left" if sibling < index else "right", padded[sibling].hex()))
        level = _next_level(level)
        index //= 2
    return path


def verify_path(fingerprint: str, path: list[tuple[str, str]], root: str) -> bool:
    """Recompute the root from one fingerprint and its path."""
    node = leaf_hash(fingerprint)
    for side, sibling_hex in path:
        sibling = bytes.fromhex(sibling_hex)
        node = _sha(sibling + node) if side == "left" else _sha(node + sibling)
    return node.hex() == root


class ChainWriter(Protocol):
    """Publishes a root to a public chain; returns a transaction id or None."""

    def write(self, root: str) -> str | None:
        """Publish the root."""


class LocalOnly:
    """No chain configured (or the web3 library is unavailable, B-001)."""

    def write(self, root: str) -> str | None:
        """Keep the root in Seedha's database only."""
        _ = root  # stored by write_bundle; nothing is published
        return None


def pending_consents(session: Session, property_id: int) -> list[Consent]:
    """Consents whose fingerprint is not yet in a bundle, oldest first."""
    return list(
        session.scalars(
            select(Consent)
            .join(Booking, Booking.id == Consent.booking_id)
            .where(Booking.property_id == property_id, Consent.proof_status == "pending")
            .order_by(Consent.given_at, Consent.id)
        )
    )


def write_bundle(
    session: Session, property_id: int, chain: ChainWriter, now: datetime
) -> ProofBundle:
    """Bundle every pending fingerprint under one root and mark them verified."""
    consents = pending_consents(session, property_id)
    root = merkle_root([c.fingerprint for c in consents])
    tx = chain.write(root)
    bundle = ProofBundle(property_id=property_id, created_at=now, merkle_root=root,
                         item_count=len(consents), chain_status="written" if tx else "stored",
                         chain_tx=tx)  # fmt: skip
    session.add(bundle)
    session.flush()
    for index, consent in enumerate(consents):
        session.add(ProofBundleItem(bundle_id=bundle.id, consent_id=consent.id,
                                    leaf_index=index, fingerprint=consent.fingerprint))  # fmt: skip
        consent.proof_status = "verified"
    session.flush()
    return bundle


def record_intact(consent: Consent) -> bool:
    """The consent row still hashes to its own fingerprint.

    An erased consent has no salt left to check and counts as intact: it can
    no longer be messaged anyway.
    """
    if consent.salt is None:
        return True
    recomputed = fingerprint(
        consent.salt, consent.booking_id, as_utc(consent.given_at), consent.wording_version
    )
    return recomputed == consent.fingerprint


def item_status(item: ProofBundleItem, consent: Consent | None, leaves: list[str]) -> str:
    """'verified', 'deleted' (erased after STOP, leaf kept) or 'mismatch'
    (the record no longer hashes to the leaf sealed in the root)."""
    if consent is None or consent.erased_at is not None:
        return "deleted"
    path = merkle_path(leaves, item.leaf_index)
    sealed = verify_path(item.fingerprint, path, item.bundle.merkle_root)
    same = consent.fingerprint == item.fingerprint and record_intact(consent)
    return "verified" if sealed and same else "mismatch"


@dataclass(frozen=True, slots=True)
class Entry:
    """One line of a bundle (or of tonight's pending list) on the proof screen."""

    consent: Consent | None
    status: str


def bundle_entries(session: Session, bundle: ProofBundle) -> list[Entry]:
    """Every sealed leaf of a bundle with its status, in leaf order."""
    items = sorted(bundle.items, key=lambda x: x.leaf_index)
    leaves = [i.fingerprint for i in items]
    entries = []
    for item in items:
        consent = session.get(Consent, item.consent_id) if item.consent_id else None
        entries.append(Entry(consent, item_status(item, consent, leaves)))
    return entries


@dataclass(frozen=True, slots=True)
class ConsentProof:
    """Everything the proof dialog shows for one consent."""

    consent: Consent
    bundle: ProofBundle | None
    path: list[tuple[str, str]]
    matches: bool | None


def consent_proof(session: Session, property_id: int, consent_id: int) -> ConsentProof:
    """The consent, its bundle and a fresh check that the fingerprint is in it."""
    consent = session.get(Consent, consent_id)
    if consent is None or consent.booking.property_id != property_id:
        raise ProofError(404, "no_such_consent", "No consent with that id")
    item = session.scalar(select(ProofBundleItem).where(ProofBundleItem.consent_id == consent.id))
    if item is None:
        return ConsentProof(consent, None, [], None)
    bundle = item.bundle
    leaves = [i.fingerprint for i in sorted(bundle.items, key=lambda x: x.leaf_index)]
    path = merkle_path(leaves, item.leaf_index)
    matches = verify_path(consent.fingerprint, path, bundle.merkle_root) and record_intact(consent)
    return ConsentProof(consent, bundle, path, matches)


def erase_consent(session: Session, consent: Consent, now: datetime) -> None:
    """DPDP erasure: drop salt and number, unlink the published fingerprint.

    The bundle keeps its fingerprint so the root stays valid, but no row links
    that fingerprint to the guest any more. Message texts are blanked.
    """
    session.execute(
        update(ProofBundleItem)
        .where(ProofBundleItem.consent_id == consent.id)
        .values(consent_id=None)
    )
    for message in session.scalars(select(Message).where(Message.consent_id == consent.id)):
        message.body = "[erased at the guest's request]"
        if message.status == "draft":
            message.status = "blocked"
    consent.salt = None
    consent.whatsapp_number = None
    consent.withdrawn_at = consent.withdrawn_at or now
    consent.erased_at = now
    consent.fingerprint = f"erased-{secrets.token_hex(28)}"
    consent.proof_status = "erased"
    session.flush()
