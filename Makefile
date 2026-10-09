# Seedha monorepo tasks. Every recipe loads .env (created from .env.example).
SHELL := /bin/bash
# Written for GNU Make 3.81 (macOS default): one shell per line, so steps chain with &&.

ROOT := $(abspath .)
API := $(ROOT)/apps/api
WEB := $(ROOT)/apps/web
FW := $(ROOT)/firmware/seedha-desk
VENV := $(API)/.venv
PY := $(VENV)/bin/python
PYTHON ?= $(shell command -v python3.12 || command -v python3.13 || command -v python3.11 || echo python3)
LOAD_ENV := set -a && { [ ! -f $(ROOT)/.env ] || . $(ROOT)/.env; } && set +a
MONEY_CODE := app/money.py,app/services/ledger.py,app/services/scenario.py

.PHONY: help env setup setup-api setup-web seed seed-full reset test test-api test-web \
        check check-api check-web dev api web demo build-web e2e firmware clean

help:
	@echo "make demo       - first run: .env, install, seed, build and start everything"
	@echo "make dev        - start API (8000) and web (3000) in dev mode"
	@echo "make seed       - fresh database with the sample hotel (no statements yet)"
	@echo "make seed-full  - same, plus the 1,500 statement lines already loaded"
	@echo "make test       - API and web unit tests"
	@echo "make check      - every quality gate (lint, types, tests, coverage, audits)"

env:
	@if [ ! -f $(ROOT)/.env ]; then cp $(ROOT)/.env.example $(ROOT)/.env; echo "Created .env from .env.example (all integrations SIMULATED)"; fi

setup: env setup-api setup-web

setup-api:
	@if [ ! -x $(PY) ]; then $(PYTHON) -m venv $(VENV); fi
	$(PY) -c 'import sys; assert sys.version_info >= (3, 11), "Python 3.11+ needed"'
	$(VENV)/bin/pip install -q --upgrade pip
	$(VENV)/bin/pip install -q -e "$(API)[dev]"

setup-web:
	cd $(WEB) && npm ci --no-audit --no-fund

seed: env
	$(LOAD_ENV) && cd $(API) && rm -f seedha.db && $(VENV)/bin/alembic upgrade head && $(PY) -m seed.load

seed-full: env
	$(LOAD_ENV) && cd $(API) && rm -f seedha.db && $(VENV)/bin/alembic upgrade head && $(PY) -m seed.load --with-statements

reset: seed

test: test-api test-web

test-api:
	cd $(API) && $(VENV)/bin/pytest -q

test-web:
	cd $(WEB) && node --test lib/*.test.ts

check: check-api check-web
	@echo "All quality gates passed."

check-api:
	cd $(API) && $(VENV)/bin/ruff check .
	cd $(API) && $(VENV)/bin/ruff format --check .
	cd $(API) && $(VENV)/bin/mypy app seed tests migrations/env.py
	cd $(API) && $(VENV)/bin/pylint app seed migrations/env.py --fail-under=9.5
	cd $(API) && $(VENV)/bin/pylint tests --disable=missing-function-docstring --fail-under=9.5
	cd $(API) && $(VENV)/bin/pytest -q --cov --cov-report=term --cov-fail-under=85
	cd $(API) && $(VENV)/bin/coverage report --include="$(MONEY_CODE)" --fail-under=100
	cd $(API) && $(VENV)/bin/bandit -c pyproject.toml -r app seed -q --severity-level medium
	cd $(API) && $(VENV)/bin/pip-audit --skip-editable --progress-spinner off
	cd $(ROOT) && git ls-files -co --exclude-standard | /usr/bin/grep -v -E '\.(png|ico|pdf|xlsx|db)$$' | xargs $(VENV)/bin/detect-secrets-hook --baseline .secrets.baseline

check-web:
	cd $(WEB) && npx next typegen > /dev/null
	cd $(WEB) && npx tsc --noEmit
	cd $(WEB) && npx eslint . --max-warnings=0
	cd $(WEB) && npx prettier --check . --log-level warn
	cd $(WEB) && node --test lib/*.test.ts
	cd $(WEB) && node scripts/audit-check.mjs

api: env
	$(LOAD_ENV) && cd $(API) && $(VENV)/bin/uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000 $(API_FLAGS)

web: env
	$(LOAD_ENV) && cd $(WEB) && npx next dev --port 3000

dev: env
	@echo "API on http://localhost:8000, web on http://localhost:3000"
	trap 'kill 0' EXIT INT TERM; $(MAKE) api API_FLAGS=--reload & $(MAKE) web & wait

build-web:
	$(LOAD_ENV) && cd $(WEB) && npx next build

demo: setup seed build-web
	@echo "Open http://localhost:3000 and log in with OWNER_PASSCODE from .env"
	trap 'kill 0' EXIT INT TERM; $(MAKE) api & ( $(LOAD_ENV) && cd $(WEB) && npx next start --port 3000 ) & wait

e2e:
	$(LOAD_ENV) && cd $(WEB) && npx playwright test

clean:
	rm -rf $(API)/seedha.db $(WEB)/.next
