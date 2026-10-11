"""Scheduled jobs. Run `python -m app.jobs nightly-proof` from cron at midnight.

Example crontab line (IST server): `0 0 * * * cd /srv/seedha/apps/api && \
.venv/bin/python -m app.jobs nightly-proof`
"""

from __future__ import annotations

import argparse
import logging

from sqlalchemy import select

from app.config import load_settings
from app.db import make_engine, make_session_factory, session_scope
from app.models import Property
from app.services.chain import writer_for
from app.services.desk import utc_now
from app.services.proof import ChainWriter, LocalOnly, ProofError, publish_bundle

logger = logging.getLogger("seedha.jobs")


def nightly_proof(database_url: str, chain: ChainWriter | None = None) -> int:
    """Bundle every property's pending fingerprints. Returns bundles written."""
    chain = chain or LocalOnly()
    written = 0
    factory = make_session_factory(make_engine(database_url))
    with session_scope(factory) as session:
        for prop in session.scalars(select(Property)):
            try:
                bundle = publish_bundle(session, prop.id, chain, utc_now())
            except ProofError:
                continue
            logger.warning("Proof bundle %s: %s fingerprints", bundle.id, bundle.item_count)
            written += 1
    return written


def main() -> None:
    """CLI entry point."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("job", choices=["nightly-proof"])
    parser.parse_args()
    settings = load_settings()
    count = nightly_proof(settings.database_url, writer_for(settings))
    print(f"Proof bundles written: {count}")  # noqa: T201


if __name__ == "__main__":
    main()
