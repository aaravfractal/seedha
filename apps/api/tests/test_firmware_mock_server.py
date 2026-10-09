"""The bench mock server drives show_qr, set_ring and print_slip (M8 check)."""

from __future__ import annotations

import importlib.util
import json
import threading
import urllib.request
from collections.abc import Iterator
from http.server import HTTPServer
from pathlib import Path
from types import ModuleType
from urllib.error import HTTPError

import pytest

MOCK = Path(__file__).resolve().parents[3] / "firmware" / "seedha-desk" / "tools" / "mock_server.py"
KEY = "bench-key"  # pragma: allowlist secret (test value)


def load_mock() -> ModuleType:
    spec = importlib.util.spec_from_file_location("mock_server", MOCK)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(name="base")
def fixture_base() -> Iterator[str]:
    server = HTTPServer(("127.0.0.1", 0), load_mock().make_handler(KEY))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()


def call(url: str, data: object = None, key: str = KEY) -> dict[str, object]:
    body = None if data is None else json.dumps(data).encode()
    request = urllib.request.Request(url, data=body, headers={"X-Device-Key": key})  # noqa: S310
    with urllib.request.urlopen(request, timeout=5) as response:  # noqa: S310
        result: dict[str, object] = json.loads(response.read())
    return result


def test_mock_server_drives_the_box(base: str) -> None:
    commands = call(f"{base}/desk/poll")["commands"]
    assert isinstance(commands, list)
    kinds = [c["kind"] for c in commands]
    assert {"show_qr", "set_ring", "print_slip"} <= set(kinds)
    assert call(f"{base}/desk/ack", {"ids": [c["id"] for c in commands]}) == {
        "acked": len(commands)
    }
    assert call(f"{base}/desk/poll")["commands"] == []


def test_mock_server_needs_the_key(base: str) -> None:
    with pytest.raises(HTTPError) as error:
        call(f"{base}/desk/poll", key="wrong")
    assert error.value.code == 401
