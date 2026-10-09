// Pins and timings for the Seedha Desk (CLAUDE.md M8).
#pragma once

#include <cstdint>

namespace seedha {

// TFT (ILI9488) pins are set as TFT_eSPI build flags in platformio.ini:
// MOSI 23, SCLK 18, CS 15, DC 2, RST 4.
constexpr int kPrinterTxPin = 17;   // ESP32 TX2 -> printer RX
constexpr int kPrinterRxPin = 16;   // ESP32 RX2 <- printer TX
constexpr uint32_t kPrinterBaud = 9600;
constexpr int kRingPin = 13;        // NeoPixel data via level shifter + 330 ohm
constexpr int kRingPixels = 16;
constexpr int kButtonPin = 27;      // to GND, internal pull-up
constexpr int kBuzzerPin = 25;      // drives an NPN transistor
constexpr uint32_t kPollIntervalMs = 2000;
constexpr uint32_t kHttpTimeoutMs = 5000;
constexpr uint32_t kDebounceMs = 40;

}  // namespace seedha
