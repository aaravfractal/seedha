#!/usr/bin/env bash
# make demo-live: the production demo on a public https link (Cloudflare quick
# tunnel to port 3000). Only the web app is exposed; the API stays on 127.0.0.1.
# Public mode: fresh per-run secrets, sample hotel only, OTP demo banner off,
# Reset demo data only from this laptop.
set -euo pipefail
# shellcheck source=scripts/demo-common.sh
. "$(dirname "${BASH_SOURCE[0]}")/demo-common.sh"

TUNNEL_RE='https://[a-z0-9]+(-[a-z0-9]+)+\.trycloudflare\.com'
TUNNEL_TIMEOUT="${TUNNEL_TIMEOUT:-30}"

# The quick tunnel URL in a cloudflared log, or nothing (skips api.trycloudflare.com).
tunnel_url() {
  { /usr/bin/grep -oE "$TUNNEL_RE" "$1" 2>/dev/null || true; } | head -n 1
}

# Poll the log every 0.5 s until the URL appears or the timeout passes.
wait_tunnel_url() {
  local log="$1" pid="$2" tries=$(( TUNNEL_TIMEOUT * 2 )) url=""
  while (( tries > 0 )); do
    url="$(tunnel_url "$log")"
    if [[ -n "$url" ]]; then printf '%s\n' "$url"; return 0; fi
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.5
    tries=$(( tries - 1 ))
  done
  return 1
}

require_cloudflared() {
  if ! command -v cloudflared >/dev/null 2>&1; then
    printf 'cloudflared is not installed. Install it with:\n  brew install cloudflared\n' >&2
    exit 1
  fi
}

main() {
  require_cloudflared
  need_setup
  load_env

  # Fresh secrets for this run only, never printed. The published demo values
  # would let anyone forge a session on a public link.
  OWNER_API_TOKEN="$(openssl rand -hex 24)"
  SESSION_SECRET="$(openssl rand -hex 32)"
  DESK_DEVICE_KEY="$(openssl rand -hex 24)"
  export OWNER_API_TOKEN SESSION_SECRET DESK_DEVICE_KEY
  export SEEDHA_PUBLIC=1
  export SEEDHA_DEMO=

  if [[ -f "$HOME/.cloudflared/config.yml" ]]; then
    say "Warning: ~/.cloudflared/config.yml exists. Quick tunnels may refuse to start; move it aside if so."
  fi

  local logdir="$ROOT/.cache/demo-live"
  mkdir -p "$logdir"
  CLEANUP_FILE="$logdir/cloudflared.log"
  : >"$CLEANUP_FILE"
  trap stop_all EXIT INT TERM

  say "Starting the Cloudflare quick tunnel to http://localhost:3000"
  cloudflared tunnel --no-autoupdate --url http://localhost:3000 >"$CLEANUP_FILE" 2>&1 &
  local tunnel_pid=$! url
  if ! url="$(wait_tunnel_url "$CLEANUP_FILE" "$tunnel_pid")"; then
    printf 'No trycloudflare URL within %s s. Last lines of the cloudflared log:\n' "$TUNNEL_TIMEOUT" >&2
    tail -n 30 "$CLEANUP_FILE" >&2 || true
    exit 1
  fi
  export PUBLIC_BASE_URL="$url"
  export WEB_ORIGIN="$url"
  say "Tunnel ready: $url"

  seed_sample
  build_web
  start_api
  (cd "$WEB" && exec npx next start -H localhost --port 3000) &
  wait_http "http://localhost:3000/" 60 || die "The web app did not start on port 3000."

  say ""
  say "Seedha is public at $url"
  print_urls "$url"
  # No -t: the CLI prints to the terminal by default (it rejects "-t terminal").
  "$WEB/node_modules/.bin/qrcode" --small "$url" || true
  say "Reset demo data works only on this laptop at http://localhost:3000."
  say "Quick tunnels have no uptime guarantee (no SLA) and the URL changes on every run."
  say "Press Ctrl+C to stop the tunnel, the API and the web app."
  wait
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main "$@"; fi
