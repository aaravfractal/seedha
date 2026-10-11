#!/usr/bin/env bash
# make demo-lan: the production demo on this Wi-Fi network, for phones and tablets.
# The web app listens on every interface (port 3000); the API stays on 127.0.0.1:8000.
set -euo pipefail
# shellcheck source=scripts/demo-common.sh
. "$(dirname "${BASH_SOURCE[0]}")/demo-common.sh"

# The Mac's Wi-Fi address (en0, else en1), or nothing.
lan_ip() {
  ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
}

main() {
  local ip
  ip="$(lan_ip)"
  [[ -n "$ip" ]] || die "No Wi-Fi address found on en0 or en1. Join a Wi-Fi network and try again."
  need_setup
  load_env
  public_mode_env
  export PUBLIC_BASE_URL="http://$ip:3000"
  export WEB_ORIGIN="$PUBLIC_BASE_URL"

  seed_sample
  build_web
  trap stop_all EXIT INT TERM
  start_api
  (cd "$WEB" && exec npx next start -H 0.0.0.0 --port 3000) &
  wait_http "http://127.0.0.1:3000/" 60 || die "The web app did not start on port 3000."

  say "Seedha is on your Wi-Fi. Phones must be on the same network."
  print_urls "$PUBLIC_BASE_URL"
  say "On this laptop use http://localhost:3000 (Reset demo data shows only there)."
  say "Sign in with Direct beta login. Claude and testnet proof writes run only on this laptop."
  say "macOS may ask whether node may accept incoming connections: choose Allow."
  say "Press Ctrl+C to stop everything."
  wait
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main "$@"; fi
