"""Run ONE real Seedha Site generation on the stored photos (manual check).

    cd apps/api && set -a && . ../../.env && set +a
    .venv/bin/python -m scripts.site_gen_once [property_id]

Needs ANTHROPIC_API_KEY and SITE_GEN_MODEL in the environment, at least 4
uploaded photos, a description and one room. It obeys the same daily and
monthly limits as the app, stores the result and the token log, and prints
only the status, fallback fields, tokens and an estimated cost. It never
prints the key or the generated text.

Estimated cost uses the prices on docs.claude.com (about-claude/pricing, read
12 Oct 2026) for claude-haiku-5-5, prompts up to 100k tokens, per million
tokens: input $0.10, output $0.50, 5-minute cache write $0.125, cache read
$0.01. Other models print no estimate.
"""

from __future__ import annotations

import sys

from sqlalchemy import select

from app.config import load_settings
from app.db import make_engine, make_session_factory
from app.models import Property
from app.services.desk import utc_now
from app.services.site_gen import ClaudeSiteWriter, NotReadyError, run_generation

# USD per million tokens: input, output, cache write (5 min), cache read.
PRICES = {"claude-haiku-5-5": (0.10, 0.50, 0.125, 0.01)}


def main(argv: list[str]) -> int:
    """Generate once and print the token use."""
    settings = load_settings()
    if not settings.site_gen_enabled:
        print("Set ANTHROPIC_API_KEY and SITE_GEN_MODEL first (nothing was sent).")
        return 2
    factory = make_session_factory(make_engine(settings.database_url))
    with factory() as session:
        query = select(Property).order_by(Property.id)
        if len(argv) > 1:
            query = query.where(Property.id == int(argv[1]))
        prop = session.scalars(query.limit(1)).first()
        if prop is None:
            print("No such property. Run make seed.")
            return 2
        writer = ClaudeSiteWriter(settings.anthropic_api_key, settings.site_gen_model)
        try:
            result = run_generation(session, prop, writer, utc_now(),
                                    settings.site_gen_monthly_token_cap)  # fmt: skip
        except NotReadyError as exc:
            print(f"Not ready: {exc}")
            return 2
        session.commit()
    usage = result.usage
    print(f"status: {result.status} {result.message}".rstrip())
    print(f"fallback fields: {', '.join(result.fallback) or 'none'}")
    print(f"model: {settings.site_gen_model}")
    print(f"input tokens: {usage.input_tokens}")
    print(f"output tokens: {usage.output_tokens}")
    print(f"cache write tokens: {usage.cache_creation_tokens}")
    print(f"cache read tokens: {usage.cache_read_tokens}")
    price = PRICES.get(settings.site_gen_model)
    if price is None:
        print("estimated cost: no documented price recorded for this model")
    else:
        counts = (usage.input_tokens, usage.output_tokens, usage.cache_creation_tokens,
                  usage.cache_read_tokens)  # fmt: skip
        cost = sum(n * p for n, p in zip(counts, price, strict=True)) / 1_000_000
        print(f"estimated cost: ${cost:.5f} (Haiku 5.5 list prices, see the docstring)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
