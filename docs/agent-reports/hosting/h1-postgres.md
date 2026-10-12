# H1 · Postgres compatibility (branch deploy-h1, 12 Oct 2026)

## Driver and URL
- `psycopg[binary]==3.3.6` (latest stable, wheels only) pinned in apps/api/pyproject.toml
  main deps. Installed into the shared venv with `--only-binary=:all:`; pip-audit clean.
- `app/db.py: normalise_database_url()` rewrites `postgres://`, `postgresql://` and
  `postgresql+psycopg2://` to `postgresql+psycopg://`, keeping `?sslmode=require` as is
  (Neon and Render forms). `make_engine` and `migrations/env.py` both use it (env.py
  also doubles `%` so URL-encoded passwords survive alembic's config interpolation).
  config.py is untouched (left to H2).
- Postgres engines use `pool_pre_ping=True` (Neon drops idle connections) and run
  `SET TIME ZONE 'UTC'` on connect. SQLite path is unchanged.
- Unit tests in tests/test_db_and_cli.py: 6 URL forms, and a psycopg engine built
  from a Neon-style URL without connecting.

## Incompatibilities found and fixed (all found by running the real suite)
1. Aware vs naive datetimes. `as_utc()` (app/services/consent.py) returned an aware
   value unchanged; Postgres returns timestamptz in the session zone (my local server
   was Asia/Kolkata), so `given_at.isoformat()` gave +05:30 and the proof re-hash of a
   consent fingerprint did not match (10 failures: proof, inbox, win-back, overview).
   Fix: `as_utc` now converts aware values with `astimezone(UTC)`; plus UTC session zone.
2. `statement_file.parse_method` was String(20) but holds e.g.
   "layout:travel-agent-register" (28). SQLite ignored it; Postgres rejects the insert
   (5 failures in statement upload/reset). Fix: model String(60) + migration
   `0013_postgres_widen_parse_method.py` (batch alter, reversible). No money data touched.
3. `answer_payouts` (app/services/ask.py) ordered by `channel.sort_order` without
   grouping by it: Postgres GroupingError. Fix: add it to GROUP BY (key is unique per
   property, so the rows and numbers are identical).

Checked and fine: no raw SQLite SQL (only `PRAGMA` in the SQLite branch and a
SQLite-only test), no strftime/julianday/GROUP_CONCAT/INSERT OR IGNORE; money is
BigInteger paise; booleans use `is_(False)`/`sa.false()`; seed inserts no explicit ids
(every id sequence is >= max(id) after `seed.load --with-statements`); demo reset
deletes in reverse FK order (works on Postgres); migrations 0001 to 0013 upgrade,
`alembic check` shows no drift, downgrade to base and upgrade again all pass on Postgres.
The public reference sample still uses an in-memory SQLite (stdlib), fine when hosted.

## Tests on Postgres
- tests/conftest.py: with `TEST_DATABASE_URL` set, one session engine creates all tables
  (drop_all/create_all), each test gets it and afterwards every table is emptied with
  `TRUNCATE ... RESTART IDENTITY CASCADE`; tables are dropped at session end. Without
  it, unchanged: fresh in-memory SQLite per test. Tests that build their own SQLite
  files (engine FK pragma, seed CLI, migrations) stay SQLite in both modes.
- Local proof: `pgserver==0.1.4` (PyPI wheel shipping PostgreSQL 16.2 binaries) installed
  into the API venv as a test tool only (not in pyproject). initdb/pg_ctl on 127.0.0.1:55432
  with the data dir in the scratchpad. Result: **957 passed, 0 failed, 0 skipped on
  PostgreSQL 16.2**, coverage 98.37% (>= 85), money code 100%. Also seeded the sample
  hotel via `alembic upgrade head` + `python -m seed.load --with-statements` on Postgres.
  Server stopped, data dir deleted, pgserver/fasteners/psutil uninstalled (pip check ok).
- SQLite: 957 passed, coverage 98.33%, money 100%; locked numbers unchanged
  (test_seed_totals, test_reseed, test_statements_api all green on both).

## CI: .github/workflows/api-postgres.yml
- On push and pull_request to `deploy` and `master`; `permissions: contents: read`.
- Job `postgres`: ubuntu-latest, `postgres:16` service with pg_isready health check and
  throwaway credentials (allowlisted for detect-secrets), Python 3.12, `pip install -e
  ".[dev]"`; alembic upgrade head / check / downgrade base / upgrade head using a
  `postgres://` URL (exercises the normaliser); seed the sample hotel; full pytest with
  `TEST_DATABASE_URL`, `--cov-fail-under=85` and money code 100%. Timeout 60 min
  (the Postgres run took ~25 min locally, sharing the CPU with the SQLite run).
- Job `sqlite`: same install, alembic upgrade + check, full pytest with the same thresholds.
- YAML validated with PyYAML. Not run on GitHub (no push from here).

## Gates (make check-api equivalents, SQLite)
ruff, ruff format --check, mypy strict (146 files), pylint 9.97 / 9.99, pytest + coverage,
money 100%, bandit, pip-audit, detect-secrets on all tracked+new files: all pass.
