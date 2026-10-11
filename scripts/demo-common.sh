# Shared steps for scripts/demo-lan.sh and scripts/demo-live.sh. Sourced, not run.
# shellcheck shell=bash

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API="$ROOT/apps/api"
WEB="$ROOT/apps/web"
VENV="$API/.venv"
export npm_config_cache="$ROOT/.cache/npm"
export NEXT_TELEMETRY_DISABLED=1

say() { printf '%s\n' "$*"; }
die() { printf 'Error: %s\n' "$*" >&2; exit 1; }

# make setup must have run once (API venv and web node_modules).
need_setup() {
  [[ -x "$VENV/bin/python" ]] || die "The API is not installed. Run make setup first."
  [[ -d "$WEB/node_modules" ]] || die "The web app is not installed. Run make setup first."
}

# Load .env like the Makefile does; the caller's exports afterwards win.
load_env() {
  if [[ ! -f "$ROOT/.env" ]]; then
    cp "$ROOT/.env.example" "$ROOT/.env"
    say "Created .env from .env.example (all integrations SIMULATED)"
  fi
  set -a
  # shellcheck disable=SC1091
  . "$ROOT/.env"
  set +a
}

# Fresh database with the sample hotel (the same steps as make seed).
seed_sample() {
  (cd "$API" && "$VENV/bin/alembic" downgrade base && "$VENV/bin/alembic" upgrade head \
    && "$VENV/bin/python" -m seed.load)
}

build_web() { (cd "$WEB" && npx next build); }

# The API never leaves this machine; the browser reaches it only through the web app.
start_api() {
  (cd "$API" && exec "$VENV/bin/uvicorn" app.main:create_app --factory --host 127.0.0.1 --port 8000) &
}

# Wait up to $2 seconds for $1 to answer.
wait_http() {
  local url="$1" tries=$(( $2 * 2 ))
  while (( tries > 0 )); do
    if curl -s -o /dev/null --max-time 2 "$url"; then return 0; fi
    sleep 0.5
    tries=$(( tries - 1 ))
  done
  return 1
}

# Stop every process this script started (cloudflared, uvicorn, next) once.
stop_all() {
  trap - EXIT INT TERM
  [[ -n "${CLEANUP_FILE:-}" ]] && rm -f "$CLEANUP_FILE"
  kill 0 2>/dev/null || true
}

print_urls() {
  local base="$1"
  say ""
  say "Owner (sign in):   $base/login"
  say "Desk device:       $base/desk/device   (sign in on that phone or tablet first)"
  say "Guest test:        $base/hotel/deodar-view   (the consent page opens from the Desk QR)"
  say ""
}
