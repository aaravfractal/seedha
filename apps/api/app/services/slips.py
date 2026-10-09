"""Printed slips: the checkout slip and the 9 PM close slip.

Ruling 4: the checkout slip uses the guest's own stored booking lines and their
channel's terms. Commission-free bookings (walk-in, direct) show no commission
or GST lines, only "Booked directly. Hotel kept Rs X." Amounts are the stored,
rounded line items (ruling 1), so a slip always agrees with the ledger.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from app.money import LineItems, format_inr, share_tenths_of_percent

COMMISSION_FREE_KINDS = frozenset({"walkin", "direct"})


@dataclass(frozen=True, slots=True)
class SlipLine:
    """One printed line: a label and, optionally, an amount in paise."""

    label: str
    amount: int | None = None
    bold: bool = False


@dataclass(frozen=True, slots=True)
class Slip:
    """A slip ready for the thermal printer or the screen."""

    title: str
    subtitle: str
    lines: list[SlipLine]
    footer: list[str] = field(default_factory=list)

    def as_text(self, width: int = 32) -> str:
        """Plain monospaced text, as an ESC/POS printer receives it."""
        out = [self.title, self.subtitle, "-" * width]
        for line in self.lines:
            if line.amount is None:
                out.append(line.label)
                continue
            amount = format_inr(line.amount).replace("₹", "Rs ").replace("−", "-")
            gap = max(1, width - len(line.label) - len(amount))
            out.append(f"{line.label}{' ' * gap}{amount}")
        if self.footer:
            out.append("-" * width)
            out.extend(self.footer)
        return "\n".join(out)


@dataclass(frozen=True, slots=True)
class CheckoutInput:
    """What the checkout slip needs from one booking."""

    hotel: str
    guest_name: str
    room: int | None
    channel_name: str
    channel_kind: str
    lines: LineItems
    perk_text: str
    perk_code: str | None


def _minus(amount: int) -> int:
    return -amount


def checkout_slip(data: CheckoutInput) -> Slip:
    """The bill summary and perk, from the guest's own booking (ruling 4)."""
    room = f" · Room {data.room}" if data.room is not None else ""
    lines = data.lines
    footer: list[str] = []
    if data.channel_kind in COMMISSION_FREE_KINDS:
        body = [
            SlipLine(f"Room ({data.channel_name})", lines.list_amount),
            SlipLine("Booked directly. Hotel kept", lines.net_kept, bold=True),
        ]
        footer.append("Thank you for booking with us directly.")
    else:
        body = [SlipLine(f"Room (via {data.channel_name})", lines.list_amount)]
        if lines.discount:
            body.append(SlipLine("Discount", _minus(lines.discount)))
        if lines.commission:
            body.append(SlipLine("Commission", _minus(lines.commission)))
        if lines.gst_on_commission:
            body.append(SlipLine("GST on commission", _minus(lines.gst_on_commission)))
        if lines.fees:
            body.append(SlipLine("Payment fees", _minus(lines.fees)))
        body.append(SlipLine("Hotel kept", lines.net_kept, bold=True))
        footer.append("Book direct next time and the hotel keeps it all.")
    if data.perk_code:
        footer.extend([f"{data.perk_text} with code", data.perk_code])
    return Slip(
        title=data.hotel.upper(), subtitle=f"{data.guest_name}{room}", lines=body, footer=footer
    )


@dataclass(frozen=True, slots=True)
class CloseInput:
    """One night's in-house stays for the close slip."""

    hotel: str
    day: date
    rooms_sold: int
    direct_rooms: int
    lines: LineItems
    saved_this_month: int


def close_slip(data: CloseInput) -> Slip:
    """The 9 PM close: rooms, gross, what channels took, net, direct share."""
    lines = data.lines
    body = [SlipLine(f"Rooms sold: {data.rooms_sold}"), SlipLine("Gross", lines.list_amount)]
    if lines.discount:
        body.append(SlipLine("Discount", _minus(lines.discount)))
    body.append(SlipLine("Commission + GST", _minus(lines.commission + lines.gst_on_commission)))
    if lines.fees:
        body.append(SlipLine("Payment fees", _minus(lines.fees)))
    body.append(SlipLine("Net kept", lines.net_kept, bold=True))
    if data.rooms_sold:
        share = share_tenths_of_percent(data.direct_rooms, data.rooms_sold)
        body.append(SlipLine(f"Direct bookings: {(share + 5) // 10}%"))
    return Slip(
        title=f"CLOSE · {data.hotel.upper()}",
        subtitle=f"{data.day.strftime('%d %b %Y')}, 9:00 PM",
        lines=body,
        footer=[f"Saved this month: {format_inr(data.saved_this_month)}"],
    )
