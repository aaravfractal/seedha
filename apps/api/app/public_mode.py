"""Public demo mode (make demo-live, make demo-lan): SEEDHA_PUBLIC=1.

Visitors who reach the demo through the tunnel or the Wi-Fi may look around
the sample hotel, but nothing they do may spend the owner's money or test
tokens: for them Claude stays off (the labelled fallbacks run) and tonight's
proof is kept local. The laptop running Seedha (loopback) keeps every feature.
The web app's BFF forwards the real client address, so a visitor never
appears as loopback (see routers/site.py local_reset_only).
"""

from __future__ import annotations

import ipaddress
import os

from fastapi import Request


def is_loopback(host: str) -> bool:
    """True for 127.0.0.0/8, ::1 and IPv4-mapped loopback; False for names and junk."""
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    mapped = getattr(ip, "ipv4_mapped", None)
    return bool(ip.is_loopback or (mapped is not None and mapped.is_loopback))


def is_remote_public(request: Request) -> bool:
    """True when SEEDHA_PUBLIC is exactly "1" and the client is not this machine."""
    if os.environ.get("SEEDHA_PUBLIC", "") != "1":
        return False
    host = request.client.host if request.client else ""
    return not is_loopback(host)
