"""make demo-live helpers: tunnel URL detection and the missing-cloudflared path.

These run pieces of scripts/demo-live.sh with bash. Nothing here starts a
tunnel, the API or the web app.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess  # nosec B404  (runs the repo's own scripts with fixed arguments)
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
LIVE = ROOT / "scripts" / "demo-live.sh"
LAN = ROOT / "scripts" / "demo-lan.sh"
BASH = shutil.which("bash") or "/bin/bash"

SAMPLE_LOG = """\
2026-10-11T09:00:00Z INF Requesting new quick Tunnel on trycloudflare.com...
2026-10-11T09:00:00Z ERR failed to reach https://api.trycloudflare.com/tunnel, retrying
2026-10-11T09:00:01Z INF +------------------------------------------------------------+
2026-10-11T09:00:01Z INF |  Your quick Tunnel has been created! Visit it at:           |
2026-10-11T09:00:01Z INF |  https://seasonal-deodar-valley-4k.trycloudflare.com        |
2026-10-11T09:00:01Z INF +------------------------------------------------------------+
"""

pytestmark = pytest.mark.skipif(not LIVE.exists(), reason="scripts/ not in this checkout")


def run_bash(script: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    # A new session, so a stray `kill 0` could never reach pytest.
    return subprocess.run(  # noqa: S603  # nosec B603
        [BASH, "-c", script],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
        env=env,
        start_new_session=True,
    )


def source(fn_call: str) -> str:
    return f'. "{LIVE}"; {fn_call}'


def test_the_url_regex_matches_the_documented_one() -> None:
    text = LIVE.read_text(encoding="utf-8")
    assert r"TUNNEL_RE='https://[a-z0-9]+(-[a-z0-9]+)+\.trycloudflare\.com'" in text
    pattern = re.compile(r"https://[a-z0-9]+(-[a-z0-9]+)+\.trycloudflare\.com")
    assert pattern.search("https://api.trycloudflare.com") is None
    assert pattern.search("https://a-b.trycloudflare.com") is not None


def test_tunnel_url_reads_the_quick_tunnel_line_and_skips_api(tmp_path: Path) -> None:
    log = tmp_path / "cloudflared.log"
    log.write_text(SAMPLE_LOG, encoding="utf-8")
    res = run_bash(source(f'tunnel_url "{log}"'))
    assert res.returncode == 0, res.stderr
    assert res.stdout.strip() == "https://seasonal-deodar-valley-4k.trycloudflare.com"


def test_tunnel_url_is_empty_without_a_url(tmp_path: Path) -> None:
    log = tmp_path / "cloudflared.log"
    log.write_text(SAMPLE_LOG.splitlines()[1] + "\n", encoding="utf-8")
    res = run_bash(source(f'tunnel_url "{log}"; tunnel_url "{tmp_path}/missing.log"'))
    assert (res.returncode, res.stdout) == (0, "")


def test_wait_finds_the_url_from_a_stub_cloudflared(tmp_path: Path) -> None:
    """A fake cloudflared on PATH prints the box after a short delay."""
    (tmp_path / "sample.log").write_text(SAMPLE_LOG, encoding="utf-8")
    stub = tmp_path / "cloudflared"
    stub.write_text(
        f'#!/bin/sh\nsleep 1\ncat "{tmp_path}/sample.log" >&2\nsleep 5\n', encoding="utf-8"
    )
    stub.chmod(0o755)
    log = tmp_path / "run.log"
    script = source(
        f'cloudflared tunnel --no-autoupdate --url http://localhost:3000 >"{log}" 2>&1 & '
        f'pid=$!; wait_tunnel_url "{log}" "$pid"; status=$?; kill "$pid"; exit "$status"'
    )
    env = {**os.environ, "PATH": f"{tmp_path}:/usr/bin:/bin", "TUNNEL_TIMEOUT": "10"}
    res = run_bash(script, env)
    assert res.returncode == 0, res.stderr
    assert res.stdout.strip() == "https://seasonal-deodar-valley-4k.trycloudflare.com"


def test_wait_gives_up_when_cloudflared_exits_without_a_url(tmp_path: Path) -> None:
    log = tmp_path / "run.log"
    log.write_text("ERR quick tunnels refuse to start with a config.yml\n", encoding="utf-8")
    res = run_bash(
        source(f'sleep 0.2 & wait_tunnel_url "{log}" "$!"'), {**os.environ, "TUNNEL_TIMEOUT": "2"}
    )
    assert (res.returncode, res.stdout) == (1, "")


def test_missing_cloudflared_prints_the_install_hint_and_fails() -> None:
    # /usr/bin and /bin hold the shell tools but never cloudflared (Homebrew puts it elsewhere).
    assert not any(Path(d, "cloudflared").exists() for d in ("/usr/bin", "/bin"))
    env = {"PATH": "/usr/bin:/bin", "HOME": os.environ.get("HOME", "/nonexistent")}
    res = run_bash(f'exec "{BASH}" "{LIVE}"', env)
    assert res.returncode == 1
    assert "brew install cloudflared" in res.stderr
    assert "Starting" not in res.stdout, "nothing may start without cloudflared"


@pytest.mark.parametrize("script", [LIVE, LAN])
def test_scripts_never_print_the_secrets(script: Path) -> None:
    for line in script.read_text(encoding="utf-8").splitlines():
        if re.search(r"\b(say|echo|printf)\b", line):
            for name in ("OWNER_API_TOKEN", "SESSION_SECRET", "DESK_DEVICE_KEY"):
                assert name not in line, line
