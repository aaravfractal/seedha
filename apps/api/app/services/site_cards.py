"""Hotel Site V2: printable cards with a QR to the hotel's own site
(docs/HOTEL_SITE_V2.md, Cards).

Pure functions, no database: the router hands over a `CardData` built from
the site's existing data. Cards carry no prices and no money at all (rule 1),
no reviews, ratings or awards, and the sample hotel's cards say "Sample"
(rule 11).

Print rules:
- every card page is trim + 3 mm bleed on each side; backgrounds run into the
  bleed; crop marks sit in the bleed outside the trim, 1 mm clear of it;
- colours are hand-picked CMYK print values (`PRINT_CMYK`, review R2-4), not a
  naive conversion of the hex (which has no magenta and prints pine as teal);
  each converts back (naive formula, `rgb_of_cmyk`) to within a small distance
  of its brand hex; QR modules are pure black (K100) for scan contrast; a final
  page lists each colour with its hex and CMYK values;
- QR: error correction level H, a 4-module quiet zone, and a printed symbol
  (dark modules, without the quiet zone) of at least 18 mm (wallet), 25 mm
  (room) or 40 mm (tent);
- the A5 tent card is one landscape A5 page folded along its horizontal
  centre line: two identical faces, the upper one turned 180 degrees so both
  read upright once the card stands; fold ticks sit in the bleed.

The perk line is the owner's own `card_perk_en`, in gold, only when the owner
set one; otherwise the card says NEUTRAL_LINE in the card's text colour and
promises nothing (review R2-1).

Faces (the owner preview matches these, review R2-3):
- wallet front: name, place, tagline, perk or neutral line; wallet back: the
  QR (card-wallet), name, "Scan to book direct", address, phone, WhatsApp;
- room front: name, place, tagline on a pine band, ROOM_HEADLINE, the perk or
  neutral line, the QR (card-room), SCAN_LINE, address; room back: "Your stay"
  (check-in and check-out on their own lines), nearby, good to know, contact;
- tent: two identical faces (name, place, perk or neutral line, SCAN_LINE,
  address, QR card-desk); "Seedha" small on the rear face only.

Fonts are the PDF built-ins (Times-Bold for headings, Helvetica for body).
There is no Devanagari TrueType font in the repo (the web's Mukta is woff2,
which reportlab cannot embed), so Hindi text is left off the cards, and any
text the built-in fonts cannot draw is left off rather than printed as boxes.
"""

from __future__ import annotations

import io
import math
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Literal
from xml.sax.saxutils import escape

from PIL import Image, ImageDraw
from reportlab.graphics.barcode import qrencoder
from reportlab.lib.colors import CMYKColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from app.config import Settings

CardKind = Literal["wallet", "room", "tent", "all"]
QrCard = Literal["wallet", "room", "desk"]

# Brand colours (the Pine mood). Gold is for the perk line only.
COLOURS: dict[str, str] = {
    "pine": "#1F4D3A",
    "cream": "#F5F1E8",
    "stone": "#E6E0D4",
    "ink": "#1D1D1F",
    "grey": "#6E6E73",
    "gold": "#E8A33D",
    "black": "#000000",
}
# Hand-picked print values (C, M, Y, K in %), review R2-4. Pine has magenta
# so it prints as a deep green, not teal; small text and grey are black-only
# (one plate, no misregistration); QR modules are K100. Each converts back by
# the naive formula to within 20 RGB units of its hex (tests check this).
PRINT_CMYK: dict[str, tuple[int, int, int, int]] = {
    "pine": (80, 40, 65, 45),
    "cream": (3, 4, 10, 0),
    "stone": (8, 10, 16, 0),
    "ink": (0, 0, 0, 90),
    "grey": (0, 0, 0, 55),
    "gold": (0, 32, 76, 7),
    "black": (0, 0, 0, 100),
}
COLOUR_USE: dict[str, str] = {
    "pine": "Backgrounds, headings on cream",
    "cream": "Backgrounds, QR panels, text on pine",
    "stone": "Secondary text on pine",
    "ink": "Body text",
    "grey": "Small print",
    "gold": "The owner's card perk line only",
    "black": "QR code modules (100% black only)",
}

MM: float = 72 / 25.4  # points per millimetre (reportlab.lib.units.mm, typed)
BLEED_MM = 3.0
HEADING_LINES = 2
SMALLEST_HEADING = 4.0
CROP_GAP_MM = 1.0
QUIET_MODULES = 4
QR_LEVEL = "H"
HEAD = "Times-Bold"
BODY = "Helvetica"
BODY_BOLD = "Helvetica-Bold"

NEUTRAL_LINE = "Book directly with the hotel"
ROOM_HEADLINE = "Your next stay, booked direct"
WALLET_SCAN = "Scan to book direct"
SCAN_LINE = "Scan to see rooms and book direct"
SAMPLE_LINE = "Sample card: fictional hotel"
BRAND = "Seedha"


@dataclass(frozen=True)
class CardSpec:
    """A card's trim size, its QR's minimum and drawn sizes (mm) and its
    scan source (`?src=`)."""

    trim_w_mm: float
    trim_h_mm: float
    qr_min_mm: float
    qr_mm: float
    src: str


CARDS: dict[str, CardSpec] = {
    "wallet": CardSpec(85.6, 54.0, 18.0, 20.0, "card-wallet"),
    "room": CardSpec(105.0, 148.0, 25.0, 30.0, "card-room"),
    "tent": CardSpec(210.0, 148.0, 40.0, 42.0, "card-desk"),
}
QR_SOURCE: dict[str, str] = {"wallet": "card-wallet", "room": "card-room", "desk": "card-desk"}
KIND_PAGES: dict[str, tuple[str, ...]] = {
    "wallet": ("wallet_front", "wallet_back"),
    "room": ("room_front", "room_back"),
    "tent": ("tent",),
    "all": ("wallet_front", "wallet_back", "room_front", "room_back", "tent"),
}


@dataclass(frozen=True)
class CardData:  # pylint: disable=too-many-instance-attributes
    """What the cards print, all from the hotel's existing site data."""

    hotel: str
    url: str
    display_url: str
    location: str = ""
    tagline: str = ""
    phone: str = ""
    whatsapp: str = ""
    email: str = ""
    address: str = ""
    check_in: str = ""
    check_out: str = ""
    nearby: tuple[str, ...] = ()
    notes: tuple[str, ...] = ()
    sample: bool = False
    hide_branding: bool = False
    perk: str = ""


def printable(text: str) -> str:
    """The text if the built-in fonts can draw all of it, else "" (never boxes)."""
    text = " ".join(text.split())
    try:
        text.encode("cp1252")
    except UnicodeEncodeError:
        return ""
    return text


def card_data(  # noqa: PLR0913  # pylint: disable=too-many-arguments
    *,
    hotel: str,
    url: str,
    display_url: str,
    location: str,
    tagline: str,
    contact: dict[str, str],
    times: tuple[str, str],
    nearby: Sequence[tuple[str, int, str]] = (),
    notes: Sequence[str] = (),
    sample: bool = False,
    hide_branding: bool = False,
    perk: str = "",
) -> CardData:
    """Build `CardData`, keeping only text the built-in fonts can print.
    `nearby` is (name, minutes, "walk" | "drive"). `perk` is the owner's card
    perk (empty: none, so the cards promise nothing)."""
    places = tuple(
        f"{name}, {minutes} min {'walk' if mode == 'walk' else 'drive'}"
        for name, minutes, mode in nearby
        if printable(name)
    )
    return CardData(
        hotel=printable(hotel) or printable(display_url),
        url=url,
        display_url=printable(display_url),
        location=printable(location),
        tagline=printable(tagline),
        phone=printable(contact.get("phone", "")),
        whatsapp=printable(contact.get("whatsapp", "")),
        email=printable(contact.get("email", "")),
        address=printable(contact.get("address", "")),
        check_in=times[0],
        check_out=times[1],
        nearby=tuple(printable(p) for p in places),
        notes=tuple(n for n in (printable(x) for x in notes) if n),
        sample=sample,
        hide_branding=hide_branding,
        perk=printable(perk),
    )


# --- colour ----------------------------------------------------------------------


def rgb_of_cmyk(cmyk: tuple[int, int, int, int]) -> tuple[int, int, int]:
    """The naive screen colour of a CMYK value (a check on the hand-picked
    values, not how a press prints)."""
    c, m, y, k = (v / 100 for v in cmyk)
    r, g, b = (round(255 * (1 - v) * (1 - k)) for v in (c, m, y))
    return (r, g, b)


def colour(name: str) -> CMYKColor:
    """A brand colour as a CMYK fill or stroke, from the print table."""
    c, m, y, k = PRINT_CMYK[name]
    return CMYKColor(c / 100, m / 100, y / 100, k / 100)


REGISTRATION = CMYKColor(1, 1, 1, 1)
PAPER = CMYKColor(0, 0, 0, 0)


# --- QR ---------------------------------------------------------------------------


def card_base_url(settings: Settings, slug: str, site_url: str) -> str:
    """The address printed cards and QR codes point at: <PUBLIC_BASE_URL>/h/<slug>
    (the mini-site inside Seedha), or the site's own address when
    PUBLIC_BASE_URL is not set."""
    if settings.public_base_url:
        return f"{settings.public_base_url.rstrip('/')}/h/{slug}"
    return site_url


def card_urls(settings: Settings, slug: str, site_url: str) -> dict[str, str]:
    """What each card's QR encodes: wallet, room and desk."""
    base = card_base_url(settings, slug, site_url)
    return {card: card_url(base, card) for card in QR_SOURCE}


def card_url(site_url: str, card: str) -> str:
    """The QR target: the site with `?src=card-<type>` (`card` is a QrCard)."""
    sep = "&" if "?" in site_url else "?"
    return f"{site_url}{sep}src={QR_SOURCE[card]}"


def qr_matrix(text: str) -> list[list[bool]]:
    """The QR symbol's modules (True = dark), level H, without the quiet zone."""
    code = qrencoder.QRCode(None, getattr(qrencoder.QRErrorCorrectLevel, QR_LEVEL))
    code.addData(text)
    code.make()
    return [[bool(cell) for cell in row] for row in code.modules]


def dark_runs(row: Sequence[bool]) -> list[tuple[int, int]]:
    """(start, length) of each run of dark modules in a row."""
    runs: list[tuple[int, int]] = []
    start = -1
    for i, dark in enumerate([*row, False]):
        if dark and start < 0:
            start = i
        elif not dark and start >= 0:
            runs.append((start, i - start))
            start = -1
    return runs


def qr_svg(text: str) -> str:
    """The QR as a standalone SVG, one unit per module, quiet zone included."""
    matrix = qr_matrix(text)
    side = len(matrix) + 2 * QUIET_MODULES
    path = "".join(
        f"M{x + QUIET_MODULES} {y + QUIET_MODULES}h{n}v1h-{n}z"
        for y, row in enumerate(matrix)
        for x, n in dark_runs(row)
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {side} {side}" '
        f'width="{side * 8}" height="{side * 8}" shape-rendering="crispEdges">'
        f"<title>{escape(text)}</title>"
        f'<rect width="{side}" height="{side}" fill="#FFFFFF"/>'
        f'<path fill="{COLOURS["black"]}" d="{path}"/></svg>\n'
    )


def qr_png(text: str, min_px: int = 1024) -> bytes:
    """The QR as a black-on-white PNG at least `min_px` wide, quiet zone included."""
    matrix = qr_matrix(text)
    side = len(matrix) + 2 * QUIET_MODULES
    scale = math.ceil(min_px / side)
    image = Image.new("1", (side * scale, side * scale), 1)
    draw = ImageDraw.Draw(image)
    for y, row in enumerate(matrix):
        for x, n in dark_runs(row):
            left, top = (x + QUIET_MODULES) * scale, (y + QUIET_MODULES) * scale
            draw.rectangle((left, top, left + n * scale - 1, top + scale - 1), fill=0)
    out = io.BytesIO()
    image.save(out, format="PNG", optimize=True)
    return out.getvalue()


def qr_panel_side(text: str, qr_mm: float) -> float:
    """The drawn QR panel's side in points (symbol plus quiet zone)."""
    modules = len(qr_matrix(text))
    return qr_mm * MM * (modules + 2 * QUIET_MODULES) / modules


def draw_qr(pdf: canvas.Canvas, text: str, x: float, y: float, qr_mm: float) -> float:
    """A cream panel (the quiet zone) with pure black (K100) modules; (x, y)
    is the panel's lower left. Returns the panel side in points."""
    matrix = qr_matrix(text)
    module = qr_mm * MM / len(matrix)
    side = module * (len(matrix) + 2 * QUIET_MODULES)
    pdf.setFillColor(colour("cream"))
    pdf.rect(x, y, side, side, stroke=0, fill=1)
    pdf.setFillColor(colour("black"))
    top = y + side - QUIET_MODULES * module
    for r, row in enumerate(matrix):
        for c, n in dark_runs(row):
            pdf.rect(x + (QUIET_MODULES + c) * module, top - (r + 1) * module,
                     n * module, module, stroke=0, fill=1)  # fmt: skip
    return side


# --- drawing helpers ----------------------------------------------------------------


@dataclass
class Page:
    """One card page: trim size in points; drawing happens in trim
    coordinates (0, 0 is the trim's lower left)."""

    pdf: canvas.Canvas
    w: float
    h: float
    fold: bool = False
    bleed: float = field(default=BLEED_MM * MM)

    def fill(self, name: str, x: float, y: float, w: float, h: float) -> None:
        """A colour block; pass edges beyond the trim to run into the bleed."""
        self.pdf.setFillColor(colour(name))
        self.pdf.rect(x, y, w, h, stroke=0, fill=1)

    def background(self, name: str) -> None:
        """The whole page, bleed included."""
        self.fill(name, -self.bleed, -self.bleed, self.w + 2 * self.bleed, self.h + 2 * self.bleed)

    def text(  # pylint: disable=too-many-arguments
        self,
        x: float,
        y: float,
        text: str,
        *,
        font: str = BODY,
        size: float = 8,
        tone: str = "ink",
        align: Literal["left", "centre", "right"] = "left",
    ) -> None:
        """One line of text."""
        if not text:
            return
        self.pdf.setFont(font, size)
        self.pdf.setFillColor(colour(tone))
        draw: Callable[[float, float, str], None] = {
            "left": self.pdf.drawString,
            "centre": self.pdf.drawCentredString,
            "right": self.pdf.drawRightString,
        }[align]
        draw(x, y, text)

    def heading(  # pylint: disable=too-many-arguments
        self,
        x: float,
        y: float,
        text: str,
        width: float,
        *,
        size: float,
        smallest: float,
        tone: str,
    ) -> None:
        """The hotel's name on baseline y: shrunk to fit one line, else set on
        two lines growing upwards (names are up to 60 characters)."""
        size = fitted(text, HEAD, size, width, smallest)
        rows = [text]
        if stringWidth(text, HEAD, size) > width:
            while True:
                rows = simpleSplit(text, HEAD, size, width)
                fits = all(stringWidth(r, HEAD, size) <= width for r in rows)
                if size <= SMALLEST_HEADING or (len(rows) <= HEADING_LINES and fits):
                    break
                size -= 0.5
        for i, row in enumerate(reversed(rows)):
            self.text(x, y + i * size * 1.1, row, font=HEAD, size=size, tone=tone)

    def lines(  # pylint: disable=too-many-arguments
        self,
        x: float,
        y: float,
        text: str,
        width: float,
        *,
        font: str = BODY,
        size: float = 8,
        tone: str = "ink",
        most: int = 3,
    ) -> float:
        """Wrapped text from baseline y down; returns the next free baseline."""
        if not text:
            return y
        for line in simpleSplit(text, font, size, width)[:most]:
            self.text(x, y, line, font=font, size=size, tone=tone)
            y -= size * 1.3
        return y


def fitted(text: str, font: str, size: float, width: float, smallest: float = 6) -> float:
    """The largest size up to `size` at which `text` fits `width`."""
    while size > smallest and stringWidth(text, font, size) > width:
        size -= 0.5
    return size


Line = tuple[float, float, float, float]


def crop_mark_lines(w: float, h: float, bleed: float, fold: bool) -> list[Line]:
    """Corner crop marks in the bleed, 1 mm clear of the trim. A fold page
    also gets ticks at the horizontal centre line."""
    gap = CROP_GAP_MM * MM
    x0, x1, y0, y1 = bleed, bleed + w, bleed, bleed + h
    marks: list[Line] = [
        (0, y0, x0 - gap, y0), (x1 + gap, y0, x1 + bleed, y0),
        (0, y1, x0 - gap, y1), (x1 + gap, y1, x1 + bleed, y1),
        (x0, 0, x0, y0 - gap), (x1, 0, x1, y0 - gap),
        (x0, y1 + gap, x0, y1 + bleed), (x1, y1 + gap, x1, y1 + bleed),
    ]  # fmt: skip
    if fold:
        mid = bleed + h / 2
        marks += [(0, mid, x0 - gap, mid), (x1 + gap, mid, x1 + bleed, mid)]
    return marks


def crop_marks(pdf: canvas.Canvas, w: float, h: float, bleed: float, fold: bool) -> None:
    """Draw the marks: white under a thin registration line so they show on
    dark and light grounds."""
    marks = crop_mark_lines(w, h, bleed, fold)
    for tone, width in ((PAPER, 0.8), (REGISTRATION, 0.25)):
        pdf.setStrokeColor(tone)
        pdf.setLineWidth(width)
        for x_a, y_a, x_b, y_b in marks:
            pdf.line(x_a, y_a, x_b, y_b)


def sample_mark(page: Page, data: CardData, tone: str) -> None:
    """Rule 11: the sample hotel's cards say so."""
    if data.sample:
        page.text(page.w - 3 * MM, page.h - 4 * MM, SAMPLE_LINE, size=5, tone=tone, align="right")


def brand_mark(page: Page, data: CardData, tone: str = "grey") -> None:
    """ "Seedha" small on backs, unless the hotel hides Seedha branding."""
    if not data.hide_branding:
        page.text(page.w - 3 * MM, 2.5 * MM, BRAND, size=5, tone=tone, align="right")


def perk_line(data: CardData, ground: str) -> tuple[str, str]:
    """(text, tone): the owner's perk in gold, or the neutral line in the
    card's text colour (pine on cream, cream on pine). Never a made-up perk."""
    if data.perk:
        return data.perk, "gold"
    return NEUTRAL_LINE, "cream" if ground == "pine" else "pine"


# --- the cards ----------------------------------------------------------------------


def wallet_front(page: Page, data: CardData) -> None:
    """Pine: the hotel's name, place and tagline, and the perk (or neutral) line."""
    page.background("pine")
    left, width = 6 * MM, page.w - 12 * MM
    page.heading(left, page.h - 17 * MM, data.hotel, width, size=16, smallest=9, tone="cream")
    page.text(left, page.h - 23 * MM, data.location, size=7, tone="stone")
    page.lines(left, page.h - 30 * MM, data.tagline, width, size=6.5, tone="cream", most=2)
    line, tone = perk_line(data, "pine")
    page.lines(left, 8 * MM, line, width, font=BODY_BOLD, size=6, tone=tone, most=2)
    sample_mark(page, data, "stone")


def wallet_back(page: Page, data: CardData) -> None:
    """Cream: the QR (wallet) and how to reach the hotel."""
    page.background("cream")
    spec = CARDS["wallet"]
    target = card_url(data.url, "wallet")
    side = qr_panel_side(target, spec.qr_mm)
    draw_qr(page.pdf, target, 3 * MM, (page.h - side) / 2, spec.qr_mm)
    left = 3 * MM + side + 3 * MM
    width = page.w - left - 4 * MM
    y = page.h - 12 * MM
    page.heading(left, y, data.hotel, width, size=10, smallest=6, tone="pine")
    y = page.lines(left, y - 5 * MM, WALLET_SCAN, width, font=BODY_BOLD, size=6.5)
    y = page.lines(left, y, data.display_url, width, size=6, tone="grey", most=2)
    for label, value in (("Phone", data.phone), ("WhatsApp", data.whatsapp)):
        if value:
            y = page.lines(left, y - 1, f"{label} {value}", width, size=6, most=1)
    sample_mark(page, data, "grey")
    brand_mark(page, data)


def room_front(page: Page, data: CardData) -> None:
    """A pine band with the hotel, then the headline, the perk (or neutral)
    line and the QR (room). The QR is on the front: guests see it first."""
    page.background("cream")
    band = 60 * MM
    page.fill("pine", -page.bleed, page.h - band, page.w + 2 * page.bleed, band + page.bleed)
    left, width = 9 * MM, page.w - 18 * MM
    page.heading(left, page.h - 24 * MM, data.hotel, width, size=22, smallest=12, tone="cream")
    page.text(left, page.h - 31 * MM, data.location, size=9, tone="stone")
    page.lines(left, page.h - 39 * MM, data.tagline, width, size=8.5, tone="cream", most=3)
    centre = page.w / 2
    page.text(centre, 76 * MM, ROOM_HEADLINE, font=HEAD, size=13, tone="pine", align="centre")
    line, tone = perk_line(data, "cream")
    for i, row in enumerate(simpleSplit(line, BODY_BOLD, 7.5, page.w - 18 * MM)[:2]):
        page.text(centre, (69 - 3.4 * i) * MM, row, font=BODY_BOLD, size=7.5, tone=tone,
                  align="centre")  # fmt: skip
    spec = CARDS["room"]
    target = card_url(data.url, "room")
    side = qr_panel_side(target, spec.qr_mm)
    draw_qr(page.pdf, target, centre - side / 2, 17 * MM, spec.qr_mm)
    page.text(centre, 12 * MM, SCAN_LINE, size=7.5, align="centre")
    page.text(centre, 7.5 * MM, data.display_url, size=7, tone="grey", align="centre")
    sample_mark(page, data, "stone")


def room_back(page: Page, data: CardData) -> None:
    """Cream: stay times, nearby places, good to know and contact."""
    page.background("cream")
    left, width = 9 * MM, page.w - 18 * MM
    y = page.h - 16 * MM
    page.heading(left, y, data.hotel, width, size=15, smallest=9, tone="pine")
    sections: list[tuple[str, list[str]]] = [
        ("Your stay", [f"Check-in from {data.check_in}" if data.check_in else "",
                       f"Check-out by {data.check_out}" if data.check_out else ""]),
        ("Nearby", list(data.nearby[:4])),
        ("Good to know", list(data.notes[:3])),
        ("Contact", [f"Phone {data.phone}" if data.phone else "",
                     f"WhatsApp {data.whatsapp}" if data.whatsapp else "",
                     data.email, data.address, data.display_url]),
    ]  # fmt: skip
    y -= 9 * MM
    for title, entries in sections:
        items = [i for i in entries if i]
        if not items or y < 24 * MM:
            continue
        page.text(left, y, title.upper(), font=BODY_BOLD, size=7, tone="pine")
        y -= 4.5 * MM
        for item in items:
            if y < 14 * MM:
                break
            y = page.lines(left, y, item, width, size=8, most=2) - 1
        y -= 3.5 * MM
    sample_mark(page, data, "grey")
    brand_mark(page, data)


def tent_face(page: Page, data: CardData, *, back: bool) -> None:
    """One 210 x 74 mm face of the tent card (desk QR), drawn from (0, 0)."""
    face_h = page.h / 2
    spec = CARDS["tent"]
    target = card_url(data.url, "desk")
    side = qr_panel_side(target, spec.qr_mm)
    qr_x = page.w - 10 * MM - side
    draw_qr(page.pdf, target, qr_x, (face_h - side) / 2, spec.qr_mm)
    left, width = 12 * MM, qr_x - 20 * MM
    page.heading(left, face_h - 20 * MM, data.hotel, width, size=26, smallest=14, tone="cream")
    page.text(left, face_h - 28 * MM, data.location, size=10, tone="stone")
    line, tone = perk_line(data, "pine")
    y = page.lines(left, face_h - 40 * MM, line, width, font=BODY_BOLD, size=10, tone=tone, most=2)
    y = page.lines(left, y - 2 * MM, SCAN_LINE, width, size=9, tone="cream", most=2)
    page.lines(left, y, data.display_url, width, size=8.5, tone="stone", most=2)
    if data.sample:
        page.text(page.w - 4 * MM, face_h - 5 * MM, SAMPLE_LINE, size=6, tone="stone",
                  align="right")  # fmt: skip
    if back:
        page.text(page.w - 4 * MM, 3 * MM, "" if data.hide_branding else BRAND, size=6,
                  tone="stone", align="right")  # fmt: skip


def tent(page: Page, data: CardData) -> None:
    """A5 landscape folded at the centre: the lower face upright, the upper
    face turned 180 degrees (the rear once standing)."""
    page.background("pine")
    tent_face(page, data, back=False)
    page.pdf.saveState()
    page.pdf.translate(page.w, page.h)
    page.pdf.rotate(180)
    tent_face(page, data, back=True)
    page.pdf.restoreState()


PAGE_DRAW: dict[str, tuple[str, Callable[[Page, CardData], None]]] = {
    "wallet_front": ("wallet", wallet_front),
    "wallet_back": ("wallet", wallet_back),
    "room_front": ("room", room_front),
    "room_back": ("room", room_back),
    "tent": ("tent", tent),
}


def colour_table(pdf: canvas.Canvas) -> None:
    """The last page: every colour used, with hex and CMYK, on A4."""
    _, height = A4
    pdf.setPageSize(A4)
    left, y = 56.0, height - 72.0
    pdf.setFillColor(colour("ink"))
    pdf.setFont(BODY_BOLD, 16)
    pdf.drawString(left, y, "Print colours")
    pdf.setFont(BODY, 9)
    pdf.drawString(
        left,
        y - 16,
        "CMYK values for the printer, chosen for print. Ask for a proof on your card stock.",
    )
    y -= 52
    pdf.setFont(BODY_BOLD, 9)
    for x, head in ((left + 50, "Colour"), (left + 150, "Hex"), (left + 230, "CMYK"),
                    (left + 340, "Used for")):  # fmt: skip
        pdf.drawString(x, y, head)
    y -= 10
    for name, hex_colour in COLOURS.items():
        y -= 34
        pdf.setFillColor(colour(name))
        pdf.setStrokeColor(colour("grey"))
        pdf.setLineWidth(0.5)
        pdf.rect(left, y - 6, 36, 24, stroke=1, fill=1)
        c, m, ye, k = PRINT_CMYK[name]
        pdf.setFillColor(colour("ink"))
        pdf.setFont(BODY, 10)
        pdf.drawString(left + 50, y + 4, name.capitalize())
        pdf.drawString(left + 150, y + 4, hex_colour)
        pdf.drawString(left + 230, y + 4, f"C{c} M{m} Y{ye} K{k}")
        pdf.setFont(BODY, 8.5)
        pdf.drawString(left + 340, y + 4, COLOUR_USE[name])
    pdf.setFont(BODY, 8.5)
    notes = (
        f"Cards have {BLEED_MM:g} mm bleed on every side; crop marks show the trim.",
        "QR codes: error correction level H with a 4-module quiet zone. Do not shrink.",
        "Print QR modules in 100% black (K100) only, never a four-colour black.",
        "Tent card: fold along the centre ticks so both faces read upright.",
    )
    y -= 40
    for note in notes:
        pdf.drawString(left, y, note)
        y -= 14
    pdf.showPage()


def cards_pdf(data: CardData, kind: CardKind) -> bytes:
    """The chosen cards, each page trim + bleed with crop marks, then the
    CMYK colour table page."""
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, invariant=1)
    pdf.setAuthor(data.hotel)
    pdf.setTitle(f"{data.hotel} cards")
    pdf.setSubject("Printable cards")
    bleed = BLEED_MM * MM
    for name in KIND_PAGES[kind]:
        card, draw = PAGE_DRAW[name]
        spec = CARDS[card]
        w, h = spec.trim_w_mm * MM, spec.trim_h_mm * MM
        pdf.setPageSize((w + 2 * bleed, h + 2 * bleed))
        page = Page(pdf, w, h, fold=card == "tent")
        pdf.saveState()
        pdf.translate(bleed, bleed)
        draw(page, data)
        pdf.restoreState()
        crop_marks(pdf, w, h, bleed, page.fold)
        pdf.showPage()
    colour_table(pdf)
    pdf.save()
    return buffer.getvalue()
