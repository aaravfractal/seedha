# Seedha Desk firmware

ESP32 + Arduino (PlatformIO). The box shows the consent QR at check-in, turns
its ring green and chimes when the guest says yes, and prints the checkout
slip. It polls the Seedha API every 2 seconds with its device key; it never
receives guest contact data.

## Wiring (CLAUDE.md M8)

| Part | ESP32 pin | Notes |
|---|---|---|
| ILI9488 TFT MOSI / SCLK / CS / DC / RST | 23 / 18 / 15 / 2 / 4 | Set as TFT_eSPI build flags |
| Thermal printer RX / TX | TX2 17 → printer RX, RX2 16 ← printer TX | ESC/POS, 9600 baud, printer on its own 5 V rail |
| NeoPixel ring data | 13 | Through a level shifter and a 330 Ω resistor |
| Button | 27 | To GND, internal pull-up. Press = reprint last slip |
| Buzzer | 25 | Through an NPN transistor |

## Build and test

```bash
python3.12 -m venv .venv && .venv/bin/pip install platformio
cp include/secrets.h.example include/secrets.h   # then fill it in; never commit it
.venv/bin/pio test -e native     # core logic, replays a real API response
.venv/bin/pio run -e seedha_desk # compile for the ESP32 (zero warnings in Seedha code)
.venv/bin/pio run -e seedha_desk -t upload
```

`test/fixtures/poll.json` is recorded from the real API by
`apps/api/tests/test_firmware_contract.py` (regenerate with
`UPDATE_FIXTURES=1`), so the firmware and the API cannot drift.

## Bench test with hardware

`python tools/mock_server.py --key <key>` replays the same check-in, consent
and checkout commands over plain HTTP on port 8099. Production uses HTTPS with
the server's root CA in `secrets.h`.
