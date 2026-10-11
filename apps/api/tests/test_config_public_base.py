"""PUBLIC_BASE_URL overrides WEB_ORIGIN for guest links (live features B3, B4)."""

import pytest

from app.config import load_settings


def test_public_base_url_wins(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("WEB_ORIGIN", "http://localhost:3000")
    monkeypatch.setenv("PUBLIC_BASE_URL", "https://sample-demo.trycloudflare.com")
    assert load_settings().web_origin == "https://sample-demo.trycloudflare.com"


def test_web_origin_when_public_base_url_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("WEB_ORIGIN", "http://localhost:3000")
    monkeypatch.delenv("PUBLIC_BASE_URL", raising=False)
    assert load_settings().web_origin == "http://localhost:3000"
