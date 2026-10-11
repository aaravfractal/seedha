# V4 Demo reliability: live features (12 Oct 2026)

Repo files were not changed. Only this report was written. Scratch logs and screenshots were kept outside the repo.
Each run was stopped by killing its own process group. Afterwards ports 3000 and 8000 were free, and no
uvicorn, next or cloudflared process was left. `make seed` ran at the end.

## What ran
1. `make demo-prod`: seed, build, start. The loop.spec.ts suite (temporary config, baseURL localhost:3000,
   no webServer) passed 2/2: the full 8-step loop in 42.7 s, and a perk code cannot be redeemed twice.
   A Playwright walk of /home, /desk/device, /proof, /calendar, /inbox and /pro got 200 on every page,
   with no page errors, no console errors and no 5xx.
   - /home: the room board shows 22 rooms with channel tags, plus the Needs-you list.
   - /desk/device: "Connected, checking every 2 seconds", Sound off, "Simulated: no paper".
   - /proof: the chain card shows "Local only, Polygon Amoy testnet is not reachable right now". GET /api/proof
     returns mode local, reason rpc_down and the wallet address, with balance null. There is no error.
     The RPC host does not resolve from this machine (curl exit 6). No write was attempted.
   - /calendar: Add events, then Read events, shows "Sample extraction. No Claude key is set, so Seedha
     shows a fixed sample event" (Winter Line Carnival, demand labelled "(sample)").
   - /inbox: 9 consented threads, with the sent win-back from the loop. /pro: the cards render with "Sample" labels.
2. Fallbacks. 228 API tests pass, including test_chain, test_chain_safety, test_events*, test_demo_scripts and
   test_public_mode_*:
   - No key: local only, reason no_key (test_without_key_chain_is_local).
   - RPC down: local only, reason rpc_down. This was also seen live on demo-prod.
   - No Claude key: labelled sample extraction. This was seen live.
   - No tunnel: `env PATH=/usr/bin:/bin bash scripts/demo-live.sh` and `make demo-live` both print
     "cloudflared is not installed. Install it with: brew install cloudflared", exit 1, start nothing
     and create no .cache/demo-live.
3. `make demo-live`: SKIPPED. `command -v cloudflared` finds nothing, and it is not in /opt/homebrew, /usr/local,
   the Homebrew Cellar or Spotlight. So the tunnel URL, the https 200 and the tunnel-specific checks were not
   run. The format the script expects is `https://<word>-<word>-...trycloudflare.com` (TUNNEL_RE). Public-mode
   guards were exercised instead through the LAN address (step 4), which is also "remote" to the API.
4. `make demo-lan`: it detected 192.168.0.106 on en0, seeded, built and started, then printed the owner, Desk and
   guest URLs. `curl http://192.168.0.106:3000/login` returned 200. The API on 192.168.0.106:8000 was refused,
   so it stays bound to 127.0.0.1. The log holds no hex secrets.
   Through http://192.168.0.106:3000 with Direct beta login:
   - /login shows no OTP demo banner.
   - POST /api/demo/reset returns 403 reset_local_only, and the Reset button is hidden on /settings.
   - POST /api/desk/close-slip returns 403 print_local_only.
   - Events extract returns mode sample.
   - GET /api/proof returns reason public_mode. After a Desk check-in and consent over the LAN,
     POST /api/proof/bundle returns 200 with chain local, reason public_mode, and the UI explains it.
   - The consent QR origin is the LAN URL.
   On localhost during the same run, reset returns 200 and the proof reason is rpc_down (the full feature
   path), as designed.

## Findings
| id | sev | file:line | problem | fix |
|----|-----|-----------|---------|-----|
| R1 | medium | (environment) | cloudflared is not installed on this Mac, even though the brief says it is. `make demo-live` stops with the install hint. The public-link demo, and README checklist steps 4-5, cannot run, and the tunnel-path checks are unverified. | `brew install cloudflared`, then re-run step 3 of V4 (tunnel URL, https 200, reset 403, print 403, proof public_mode). |
| R2 | medium | Makefile:125 (also Makefile:119 `demo`) | `make demo-prod` runs `next start` with no `-H`, so it listens on every interface (the log shows Network: http://192.168.0.106:3000, and the LAN /login returned 200). It uses the .env SESSION_SECRET, OWNER_API_TOKEN and DESK_DEVICE_KEY, all identical to the published .env.example values, and SEEDHA_DEMO=1. At a hackathon venue Wi-Fi anyone can sign in, see OTP codes, forge sessions and reset the demo. SEEDHA_PUBLIC is not set, so Claude and testnet writes are open to them too. This is the same class of issue as S3, now on the judging target. | Add `-H localhost` to `next start` in demo-prod and demo. Phones use demo-lan, which already has public-mode safety. |
| R3 | low | apps/api/app/main.py:110 | /health reports `proof_chain: "live"` whenever a key, RPC and chain ID are configured, even while /proof reports local and rpc_down. This can mislead anyone using /health as a pre-demo check. | Report "configured" there, or reuse the cached chain status (live, local or reason). |
| R4 | low | scripts/demo-live.sh:66-77 | The tunnel URL is printed and live before seed and `next build` finish (about 1-2 min). A visitor in that window gets a Cloudflare 502. It is harmless, but the URL is shown early. | Print the "Tunnel ready" line as "starting..." or start the tunnel after the build. Cloudflare only needs the origin when traffic arrives. |

Not re-tested here, already covered by V1 and unit tests: S1 (Claude off for public visitors) and S3
(demo-lan fresh secrets). Both were confirmed by test_public_mode_spend and by the LAN run above.

## Verdict
The 8-step loop, the room board, the Desk device, the Proof fallback, Event sample extraction, the Inbox and Pro
all work on the production build. Every fallback (no key, RPC down, no Claude key, no cloudflared) degrades with a
label and no error. demo-lan's public-mode guards hold. Open items: install cloudflared and verify demo-live (R1),
and bind demo-prod to localhost (R2).
