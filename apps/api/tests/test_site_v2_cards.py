"""Hotel Site V2 printable cards (docs/HOTEL_SITE_V2.md, Cards): owner-only
PDFs with bleed, crop marks, CMYK colours and a colour table; QR codes at
level H with a 4-module quiet zone pointing at the site with ?src=card-*."""

from __future__ import annotations

import io
import math
from typing import Any

import pdfplumber
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Property
from app.services.site import get_config
from app.services.site_cards import (
    BLEED_MM,
    CARDS,
    COLOURS,
    MM,
    NEUTRAL_LINE,
    PRINT_CMYK,
    QUIET_MODULES,
    CardData,
    card_data,
    card_url,
    cards_pdf,
    colour,
    dark_runs,
    fitted,
    printable,
    qr_matrix,
    qr_png,
    qr_svg,
    rgb_of_cmyk,
)
from app.services.site_details import SAMPLE_DETAILS

SITE = "http://localhost:3000/h/deodar-view"
PAGES = {"wallet": 3, "room": 3, "tent": 2, "all": 6}
PAGE_CARD = {
    "wallet": ["wallet", "wallet"],
    "room": ["room", "room"],
    "tent": ["tent"],
    "all": ["wallet", "wallet", "room", "room", "tent"],
}
BACKS = (1, 3, 4)  # wallet back, room back, tent (its rear face) in kind=all
EC_LEVEL_BITS = {"L": 0b01, "M": 0b00, "Q": 0b11, "H": 0b10}
FORMAT_MASK = 0b101010000010010


def pdf_for(client: TestClient, owner: dict[str, str], kind: str) -> Any:
    res = client.get(f"/site/cards.pdf?kind={kind}", headers=owner)
    assert res.status_code == 200, res.text
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF")
    return pdfplumber.open(io.BytesIO(res.content))


def ec_level(matrix: list[list[bool]]) -> str:
    """Read the error correction level from the symbol's own format bits
    (row 8, columns 0 to 5, 7 and 8), independent of the encoder."""
    cols = [0, 1, 2, 3, 4, 5, 7, 8]
    rows = [7, 5, 4, 3, 2, 1, 0]
    bits = [matrix[8][c] for c in cols] + [matrix[r][8] for r in rows]
    value = int("".join("1" if b else "0" for b in bits), 2) ^ FORMAT_MASK
    level_bits = value >> 13
    return next(k for k, v in EC_LEVEL_BITS.items() if v == level_bits)


def dark(image: Image.Image, x: int, y: int) -> bool:
    value = image.getpixel((x, y))
    assert isinstance(value, int)
    return value < 128


def png_matrix(data: bytes) -> tuple[list[list[bool]], int]:
    """Sample a QR PNG at each module centre; returns the symbol (quiet zone
    stripped, which must be all light) and the image side."""
    image = Image.open(io.BytesIO(data)).convert("L")
    side = image.width
    # the module size from the top-left finder pattern (7 modules wide)
    left = 0
    while not dark(image, left, left):
        left += 1
    width = 0
    while dark(image, left + width, left):
        width += 1
    module = width // 7
    assert left == QUIET_MODULES * module
    total = side // module
    grid = [
        [dark(image, c * module + module // 2, r * module + module // 2)
         for c in range(total)]
        for r in range(total)
    ]  # fmt: skip
    quiet = [cell for r, row in enumerate(grid) for c, cell in enumerate(row)
             if min(r, c) < QUIET_MODULES or max(r, c) >= total - QUIET_MODULES]  # fmt: skip
    assert not any(quiet)
    inner = [row[QUIET_MODULES:-QUIET_MODULES] for row in grid[QUIET_MODULES:-QUIET_MODULES]]
    return inner, side


def readable(page: Any) -> str:
    """A page's text read both ways (the tent's rear face is printed upside down)."""
    text = page.extract_text() or ""
    return f"{text}\n{text[::-1]}"


def tone_of(value: Any) -> tuple[float, ...]:
    return tuple(round(float(v), 4) for v in value)


def ink_rects(page: Any) -> list[dict[str, Any]]:
    """The QR modules: pure black (K100) rects."""
    ink = tuple(float(v) for v in colour("black").cmyk())
    return [
        r for r in page.rects
        if r.get("non_stroking_color") is not None
        and tuple(round(float(v), 4) for v in r["non_stroking_color"]) == tuple(
            round(v, 4) for v in ink)
    ]  # fmt: skip


# --- routes --------------------------------------------------------------------------


@pytest.mark.usefixtures("base_sample")
@pytest.mark.parametrize(
    "path", ["/site/cards.pdf?kind=all", "/site/cards/qr.svg?card=wallet",
             "/site/cards/qr.png?card=desk"],
)  # fmt: skip
def test_card_routes_are_owner_only(client: TestClient, path: str) -> None:
    assert client.get(path).status_code == 401
    assert client.get(path, headers={"Authorization": "Bearer wrong"}).status_code == 401


@pytest.mark.usefixtures("base_sample")
@pytest.mark.parametrize(
    "path", ["/site/cards.pdf?kind=desk", "/site/cards.pdf?kind=", "/site/cards/qr.svg?card=tent",
             "/site/cards/qr.png?card=x", "/site/cards/qr.png", "/site/cards/qr.svg"],
)  # fmt: skip
def test_bad_card_params_are_422(client: TestClient, owner: dict[str, str], path: str) -> None:
    assert client.get(path, headers=owner).status_code == 422


def check_card_page(page: Any, card: str) -> None:
    """Trim + bleed size, crop marks outside the trim, background into the
    bleed, CMYK fills, the Sample label and no price or banned copy."""
    bleed, edge = BLEED_MM * MM, 0.01
    spec = CARDS[card]
    trim_w, trim_h = spec.trim_w_mm * MM, spec.trim_h_mm * MM
    assert abs(float(page.width) - (trim_w + 2 * bleed)) < 0.5
    assert abs(float(page.height) - (trim_h + 2 * bleed)) < 0.5
    outside = [
        ln for ln in page.lines
        if ln["x1"] <= bleed + edge or ln["x0"] >= bleed + trim_w - edge
        or ln["bottom"] <= bleed + edge or ln["top"] >= bleed + trim_h - edge
    ]  # fmt: skip
    assert len(outside) == len(page.lines) >= 16  # 8 marks, white under registration
    assert any(r["x0"] <= edge and r["top"] <= edge and r["x1"] >= float(page.width) - edge
               and r["bottom"] >= float(page.height) - edge for r in page.rects)  # fmt: skip
    fills = [r["non_stroking_color"] for r in page.rects]
    assert fills and all(len(f) == 4 for f in fills)
    text = page.extract_text()
    assert "Sample" in text
    for banned in ("₹", "Rs", "INR", "!", "\u2014", "review", "rating", "award"):
        assert banned not in text, banned


@pytest.mark.usefixtures("base_sample")
@pytest.mark.parametrize("kind", ["wallet", "room", "tent", "all"])
def test_each_kind_is_a_print_ready_pdf(
    client: TestClient, owner: dict[str, str], kind: str
) -> None:
    res = client.get(f"/site/cards.pdf?kind={kind}", headers=owner)
    assert res.headers["content-disposition"] == (
        f'attachment; filename="deodar-view-cards-{kind}.pdf"'
    )
    with pdf_for(client, owner, kind) as pdf:
        assert len(pdf.pages) == PAGES[kind]
        for page, card in zip(pdf.pages, PAGE_CARD[kind], strict=False):
            check_card_page(page, card)
        table = pdf.pages[-1].extract_text()
        assert "Print colours" in table
        for name, hex_colour in COLOURS.items():
            c, m, y, k = PRINT_CMYK[name]
            assert hex_colour in table and f"C{c} M{m} Y{y} K{k}" in table, name


@pytest.mark.usefixtures("base_sample")
@pytest.mark.parametrize("kind", ["wallet", "room", "tent"])
def test_printed_qr_meets_the_minimum_size(
    client: TestClient, owner: dict[str, str], kind: str
) -> None:
    with pdf_for(client, owner, kind) as pdf:
        qr_page = pdf.pages[1] if kind == "wallet" else pdf.pages[0]
        rects = ink_rects(qr_page)
        if kind == "tent":  # two faces: keep the lower (upright) one
            middle = float(qr_page.height) / 2
            rects = [r for r in rects if r["top"] > middle]
        assert rects
        width = max(r["x1"] for r in rects) - min(r["x0"] for r in rects)
        height = max(r["bottom"] for r in rects) - min(r["top"] for r in rects)
        assert min(width, height) / MM >= CARDS[kind].qr_min_mm
        assert abs(width - height) < 0.5


@pytest.mark.usefixtures("base_sample")
def test_backs_say_seedha_unless_branding_is_hidden(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    with pdf_for(client, owner, "all") as pdf:
        texts = [readable(p) for p in pdf.pages]
    assert all("Seedha" in texts[i] for i in BACKS)
    assert not any("Seedha" in texts[i] for i in (0, 2))
    get_config(session, 1).hide_branding = True
    session.commit()
    with pdf_for(client, owner, "all") as pdf:
        assert not any("Seedha" in readable(p) for p in pdf.pages)
        assert "Seedha" not in str(pdf.metadata)


@pytest.mark.usefixtures("base_sample")
def test_own_hotel_cards_are_not_labelled_sample(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    prop = session.scalars(select(Property)).one()
    prop.is_sample = False
    session.commit()
    with pdf_for(client, owner, "all") as pdf:
        assert not any("Sample" in (p.extract_text() or "") for p in pdf.pages)
        assert "+91 90000 00000" not in "".join(p.extract_text() or "" for p in pdf.pages)


@pytest.mark.usefixtures("base_sample")
@pytest.mark.parametrize("card", ["wallet", "room", "desk"])
def test_qr_downloads_encode_the_site_with_the_card_source(
    client: TestClient, owner: dict[str, str], card: str
) -> None:
    target = f"{SITE}?src=card-{card}"
    svg = client.get(f"/site/cards/qr.svg?card={card}", headers=owner)
    assert svg.status_code == 200 and svg.headers["content-type"].startswith("image/svg+xml")
    assert f"<title>{target}</title>" in svg.text
    png = client.get(f"/site/cards/qr.png?card={card}", headers=owner)
    assert png.status_code == 200 and png.headers["content-type"] == "image/png"
    matrix, side = png_matrix(png.content)
    assert side >= 1024
    assert matrix == qr_matrix(target)
    assert ec_level(matrix) == "H"


# --- units ---------------------------------------------------------------------------


def test_qr_matrix_is_level_h_and_svg_has_the_quiet_zone() -> None:
    target = card_url(SITE, "room")
    assert target == f"{SITE}?src=card-room"
    assert card_url(f"{SITE}?lang=hi", "desk") == f"{SITE}?lang=hi&src=card-desk"
    matrix = qr_matrix(target)
    assert ec_level(matrix) == "H"
    side = len(matrix) + 2 * QUIET_MODULES
    svg = qr_svg(target)
    assert f'viewBox="0 0 {side} {side}"' in svg
    assert f"M{QUIET_MODULES} {QUIET_MODULES}h7v1h-7z" in svg  # finder starts after the zone
    assert png_matrix(qr_png(target, min_px=300))[0] == matrix


def test_qr_sizes_meet_the_brief_minimums() -> None:
    minimums = {"wallet": 18, "room": 25, "tent": 40}
    for card, spec in CARDS.items():
        assert minimums[card] == spec.qr_min_mm <= spec.qr_mm


def test_helpers() -> None:
    assert dark_runs([True, True, False, True]) == [(0, 2), (3, 1)]
    assert not dark_runs([])
    assert rgb_of_cmyk((0, 0, 0, 100)) == (0, 0, 0)
    assert rgb_of_cmyk((0, 0, 0, 0)) == (255, 255, 255)
    assert printable("  Deodar   View ") == "Deodar View"
    assert printable("देवदार व्यू") == ""
    assert fitted("A very long hotel name indeed", "Times-Bold", 30, 50, 9) == 9


def sample_card(**over: Any) -> CardData:
    base: dict[str, Any] = {
        "hotel": "Pine Rest", "url": "https://pine-rest.example.in",
        "display_url": "pine-rest.example.in", "location": "Landour", "tagline": "",
        "contact": {"phone": "+91 98000 00001", "email": "stay@example.com"},
        "times": ("13:00", "10:00"),
    }  # fmt: skip
    base.update(over)
    return card_data(**base)


def test_hindi_or_unprintable_text_is_left_off_not_boxed() -> None:
    data = sample_card(hotel="देवदार व्यू", location="मसूरी",
                       nearby=[("गन हिल", 10, "drive"), ("Gun Hill", 10, "drive")],
                       notes=["गर्म पानी", "Hot water all day."])  # fmt: skip
    assert data.hotel == "pine-rest.example.in"  # falls back to the address
    assert data.location == "" and data.nearby == ("Gun Hill, 10 min drive",)
    assert data.notes == ("Hot water all day.",)
    with pdfplumber.open(io.BytesIO(cards_pdf(data, "all"))) as pdf:
        text = "".join(p.extract_text() or "" for p in pdf.pages)
    assert "Gun Hill, 10 min drive" in text and "stay@example.com" in text
    assert "Sample" not in text


def test_long_text_stays_on_the_card() -> None:
    long = "A long line about the hotel that goes on " * 6
    data = sample_card(hotel="The Exceptionally Long Named Heritage Hill Retreat",
                       tagline=long, notes=[long] * 8, perk=long[:100],
                       nearby=[("Place", 5, "walk")] * 8,
                       contact={"phone": "+91 98000 00001", "whatsapp": "+91 98000 00002",
                                "email": "stay@example.com", "address": long})  # fmt: skip
    with pdfplumber.open(io.BytesIO(cards_pdf(data, "all"))) as pdf:
        for page in pdf.pages[:-1]:
            bleed = BLEED_MM * MM
            for ch in page.chars:
                assert bleed - 0.5 <= ch["x0"] and ch["x1"] <= float(page.width) - bleed + 0.5
                assert bleed - 0.5 <= ch["top"] and ch["bottom"] <= float(page.height) - bleed + 0.5


# --- review fixes: perk honesty, print colours, stay lines, rate limit -----------------


def gold_text(page: Any) -> str:
    gold = tone_of(colour("gold").cmyk())
    return "".join(c["text"] for c in page.chars if tone_of(c["non_stroking_color"]) == gold)


def test_print_colours_are_hand_picked_and_close_to_the_brand() -> None:
    """R2-4: pine carries magenta (no teal cast); each value converts back by
    the naive formula to within 20 RGB units of its hex; the QR is K100."""
    assert set(PRINT_CMYK) == set(COLOURS)
    for name, hex_colour in COLOURS.items():
        target = tuple(int(hex_colour[i : i + 2], 16) for i in (1, 3, 5))
        assert math.dist(rgb_of_cmyk(PRINT_CMYK[name]), target) <= 20, name
    assert PRINT_CMYK["pine"][1] >= 30  # magenta keeps pine green, not teal
    assert PRINT_CMYK["black"] == (0, 0, 0, 100)
    assert 'fill="#000000"' in qr_svg(card_url(SITE, "room"))


@pytest.mark.usefixtures("base_sample")
def test_sample_cards_print_the_owner_perk_in_gold(
    client: TestClient, owner: dict[str, str]
) -> None:
    """R2-1: the sample hotel's perk is its labelled sample perk, in gold."""
    perk = SAMPLE_DETAILS.card_perk_en
    assert perk.startswith("Sample perk:") and SAMPLE_DETAILS.card_perk_hi.startswith("नमूना")
    with pdf_for(client, owner, "all") as pdf:
        golds = [gold_text(p).replace(" ", "") for p in pdf.pages]
        texts = [readable(p) for p in pdf.pages]
    squashed = perk.replace(" ", "")
    for i in (0, 2, 4):  # wallet front, room front, tent
        assert squashed in golds[i] or squashed in golds[i][::-1] or squashed[:30] in golds[i]
    assert not any(golds[i] for i in (1, 3))  # backs carry no gold
    assert not any(NEUTRAL_LINE in t for t in texts)
    assert not any("welcome perk" in t for t in texts)


@pytest.mark.usefixtures("base_sample")
def test_without_an_owner_perk_the_cards_promise_none(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    """R2-1: no perk set means a neutral line in the text colour, no gold."""
    prop = session.scalars(select(Property)).one()
    prop.is_sample = False
    session.commit()
    with pdf_for(client, owner, "all") as pdf:
        pages = list(pdf.pages)[:-1]
        assert all(gold_text(p) == "" for p in pages)
        texts = [readable(p) for p in pages]
        for i in (0, 2, 4):
            assert NEUTRAL_LINE in texts[i]
        assert not any("perk" in t.lower() for t in texts)
        pine, cream = tone_of(colour("pine").cmyk()), tone_of(colour("cream").cmyk())
        room_neutral = [c for c in pages[2].chars if c["text"] == "B" and c["size"] < 8]
        assert room_neutral and tone_of(room_neutral[0]["non_stroking_color"]) == pine
        wallet = [c for c in pages[0].chars if c["text"] == "B"]
        assert wallet and tone_of(wallet[-1]["non_stroking_color"]) == cream


@pytest.mark.usefixtures("base_sample")
def test_an_owner_perk_prints_as_written(
    client: TestClient, owner: dict[str, str], session: Session
) -> None:
    prop = session.scalars(select(Property)).one()
    prop.is_sample = False
    session.commit()
    body = client.get("/site/details", headers=owner).json()
    for key in ("amenity_labels", "sample"):
        body.pop(key)
    body["card_perk_en"] = "Hot pakoras on your first evening"
    assert client.put("/site/details", headers=owner, json=body).status_code == 200
    with pdf_for(client, owner, "room") as pdf:
        assert gold_text(pdf.pages[0]).replace(" ", "") == "Hotpakorasonyourfirstevening"
        assert NEUTRAL_LINE not in pdf.pages[0].extract_text()


def test_room_back_prints_check_in_and_out_on_their_own_lines() -> None:
    """R2-13."""
    with pdfplumber.open(io.BytesIO(cards_pdf(sample_card(), "room"))) as pdf:
        lines = (pdf.pages[1].extract_text() or "").splitlines()
    assert "Check-in from 13:00" in lines and "Check-out by 10:00" in lines


def test_room_qr_is_on_the_front_and_the_tent_has_two_faces() -> None:
    """R2-3: the room card's QR is on its front; the tent's two faces each
    have one (the layout the owner preview mirrors)."""
    with pdfplumber.open(io.BytesIO(cards_pdf(sample_card(), "all"))) as pdf:
        counts = [len(ink_rects(p)) > 0 for p in pdf.pages[:-1]]
        tent = pdf.pages[4]
        middle = float(tent.height) / 2
        lower = [r for r in ink_rects(tent) if r["top"] > middle]
        upper = [r for r in ink_rects(tent) if r["bottom"] < middle]
    assert counts == [False, True, True, False, True]
    assert lower and len(lower) == len(upper)


@pytest.mark.usefixtures("base_sample")
def test_card_downloads_are_rate_limited(client: TestClient, owner: dict[str, str]) -> None:
    """R1-11: 20 a minute per client across the PDF and QR routes."""
    codes = [client.get("/site/cards/qr.svg?card=room", headers=owner).status_code
             for _ in range(20)]  # fmt: skip
    assert set(codes) == {200}
    assert client.get("/site/cards.pdf?kind=wallet", headers=owner).status_code == 429
    assert client.get("/site/cards/qr.png?card=desk", headers=owner).status_code == 429
