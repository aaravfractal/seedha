"""Bench mock of the Seedha API for a real Desk box (no database needed).

Run:  python tools/mock_server.py --key <device key> [--port 8099]
Point SEEDHA_API_BASE at http://<laptop-ip>:8099 for a bench test (use the
real HTTPS API in production). It replays test/fixtures/poll.json, a response
recorded from the real API, then serves no commands once they are acked.
Only the Python standard library is used.
"""

from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

FIXTURE = Path(__file__).resolve().parent.parent / "test" / "fixtures" / "poll.json"


def make_handler(device_key: str) -> type[BaseHTTPRequestHandler]:
    commands = json.loads(FIXTURE.read_text(encoding="utf-8"))["commands"]
    acked: set[int] = set()

    class Handler(BaseHTTPRequestHandler):
        def _authorised(self) -> bool:
            if self.headers.get("X-Device-Key") == device_key:
                return True
            self._send(401, {"error": {"code": "unknown_device", "message": "bad key"}})
            return False

        def _send(self, status: int, body: object) -> None:
            raw = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self) -> None:  # noqa: N802 (http.server naming)
            if self.path != "/desk/poll" or not self._authorised():
                return
            pending = [c for c in commands if c["id"] not in acked]
            self._send(200, {"commands": pending, "server_time": "2026-10-13T09:00:00+00:00"})

        def do_POST(self) -> None:  # noqa: N802
            if self.path != "/desk/ack" or not self._authorised():
                return
            length = int(self.headers.get("Content-Length", "0"))
            ids = json.loads(self.rfile.read(length) or b"{}").get("ids", [])
            acked.update(int(i) for i in ids)
            print(f"acked {sorted(acked)}")  # noqa: T201
            self._send(200, {"acked": len(ids)})

    return Handler


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--key", required=True)
    parser.add_argument("--port", type=int, default=8099)
    args = parser.parse_args()
    HTTPServer(("0.0.0.0", args.port), make_handler(args.key)).serve_forever()  # noqa: S104


if __name__ == "__main__":
    main()
