"""Scan every commit in this repository's history for secrets.

`make check` scans the working tree; this scans each past commit's tree too,
so a secret that was committed and later removed is still caught. Uses
detect-secrets' default plugins and filters, the same set .secrets.baseline
was made with (a scan with --baseline would rewrite that file). Inline
`pragma: allowlist secret` comments are honoured, as in the hook.

Run with: make secrets-history
"""

from __future__ import annotations

import json
import subprocess  # noqa: S404  (fixed git and detect-secrets commands, no shell)
import sys
import tarfile
import tempfile
from io import BytesIO
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BINARY = (".png", ".ico", ".pdf", ".xlsx", ".db")


def git(*args: str) -> bytes:
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True).stdout  # noqa: S603, S607


def scan_commit(commit: str, detect: Path) -> dict[str, list[dict[str, object]]]:
    with tempfile.TemporaryDirectory() as tmp:
        with tarfile.open(fileobj=BytesIO(git("archive", commit))) as tar:
            tar.extractall(tmp, filter="data")
        files = [str(p.relative_to(tmp)) for p in Path(tmp).rglob("*")
                 if p.is_file() and not p.name.endswith(BINARY)]  # fmt: skip
        if not files:
            return {}
        out = subprocess.run(  # noqa: S603
            [str(detect), "scan", "--", *files],
            cwd=tmp, check=False, capture_output=True, text=True,
        )  # fmt: skip
        if out.returncode != 0:
            sys.exit(f"detect-secrets failed on {commit}: {out.stderr}")
        results: dict[str, list[dict[str, object]]] = json.loads(out.stdout)["results"]
        return results


def main() -> int:
    detect = ROOT / "apps/api/.venv/bin/detect-secrets"
    commits = git("rev-list", "--all").decode().split()
    found = 0
    for commit in commits:
        for path, hits in scan_commit(commit, detect).items():
            for hit in hits:
                found += 1
                print(f"{commit[:7]} {path}:{hit['line_number']} {hit['type']}")
    print(f"Scanned {len(commits)} commits: {found} possible secrets.")
    return 1 if found else 0


if __name__ == "__main__":
    sys.exit(main())
