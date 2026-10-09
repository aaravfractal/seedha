// Seedha Desk: the box on the reception counter.
//
// Polls GET /desk/poll every 2 s over HTTPS with its device key, runs the
// commands (QR on the screen, ring colour, chime, printed slip) through
// DeskCore, then POSTs /desk/ack. Acks that fail are kept and retried, and
// commands already run are never run twice. The button reprints the last slip.
// Secrets live only in include/secrets.h (gitignored).

#include <Adafruit_NeoPixel.h>
#include <Arduino.h>
#include <HTTPClient.h>
#include <TFT_eSPI.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <qrcode.h>

#include <string>

#include "config.h"
#include "desk_core.h"
#include "secrets.h"

namespace {

constexpr uint16_t kBackground = 0x08A2;  // #0E1512 in RGB565
constexpr uint16_t kMuted = 0xB5B6;
constexpr int kQrVersion = 6;  // up to 134 characters at low error correction

TFT_eSPI tft;
Adafruit_NeoPixel ring(seedha::kRingPixels, seedha::kRingPin, NEO_GRB + NEO_KHZ800);
WiFiClientSecure tls;
WiFiClient plain;  // bench only: used when SEEDHA_API_BASE starts with http://

WiFiClient& apiClient() {
  static const bool useTls = String(SEEDHA_API_BASE).startsWith("https://");
  return useTls ? static_cast<WiFiClient&>(tls) : plain;
}

class DeskHardware : public seedha::Hardware {
 public:
  void showQr(const std::string& url, const std::string& text) override {
    clear();
    QRCode qr;
    uint8_t buffer[qrcode_getBufferSize(kQrVersion)];
    if (qrcode_initText(&qr, buffer, kQrVersion, ECC_LOW, url.c_str()) != 0) {
      title("Ask the desk for a new QR", "");
      return;
    }
    const int scale = 4;
    const int quiet = 2;
    const int side = (qr.size + 2 * quiet) * scale;
    const int left = (tft.width() - side) / 2;
    const int top = 30;
    tft.fillRect(left, top, side, side, TFT_WHITE);
    for (uint8_t y = 0; y < qr.size; ++y) {
      for (uint8_t x = 0; x < qr.size; ++x) {
        if (qrcode_getModule(&qr, x, y)) {
          tft.fillRect(left + (x + quiet) * scale, top + (y + quiet) * scale, scale, scale,
                       kBackground);
        }
      }
    }
    tft.setTextColor(kMuted, kBackground);
    tft.setTextDatum(MC_DATUM);
    tft.drawString(text.c_str(), tft.width() / 2, top + side + 24, 2);
  }

  void showOk(const std::string& text, const std::string& sub) override {
    clear();
    tft.fillCircle(tft.width() / 2, 110, 40, TFT_GREEN);
    title(text, sub);
  }

  void showText(const std::string& text, const std::string& sub) override {
    clear();
    title(text, sub);
  }

  void showIdle() override {
    idleAtMs_ = millis() + 2600;  // leave the last screen up briefly, like the simulator
  }

  void setRing(bool green) override {
    ring.fill(green ? ring.Color(52, 199, 89) : ring.Color(0, 0, 0));
    ring.show();
  }

  void beep() override {
    tone(seedha::kBuzzerPin, 880, 120);
    delay(130);
    tone(seedha::kBuzzerPin, 1320, 180);
  }

  void printSlip(const std::string& escposBytes) override {
    Serial2.write(reinterpret_cast<const uint8_t*>(escposBytes.data()), escposBytes.size());
  }

  void tick() {
    if (idleAtMs_ != 0 && static_cast<int32_t>(millis() - idleAtMs_) >= 0) {
      idleAtMs_ = 0;
      idle();
      setRing(false);
    }
  }

  void idle() {
    clear();
    title("Seedha", "Ready");
  }

 private:
  void clear() { tft.fillScreen(kBackground); }

  void title(const std::string& text, const std::string& sub) {
    tft.setTextDatum(MC_DATUM);
    tft.setTextColor(TFT_WHITE, kBackground);
    tft.drawString(text.c_str(), tft.width() / 2, tft.height() / 2 + 40, 4);
    tft.setTextColor(kMuted, kBackground);
    tft.drawString(sub.c_str(), tft.width() / 2, tft.height() / 2 + 76, 2);
  }

  uint32_t idleAtMs_ = 0;
};

DeskHardware hardware;
seedha::DeskCore core(hardware);
uint32_t lastPollMs = 0;
uint32_t lastButtonChangeMs = 0;
int lastButtonLevel = HIGH;

bool ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  WiFi.begin(SEEDHA_WIFI_SSID, SEEDHA_WIFI_PASSWORD);
  for (int i = 0; i < 20 && WiFi.status() != WL_CONNECTED; ++i) delay(250);
  return WiFi.status() == WL_CONNECTED;
}

void sendAcks() {
  const std::string body = core.ackBody();
  if (body.empty()) return;
  HTTPClient http;
  http.setTimeout(seedha::kHttpTimeoutMs);
  if (!http.begin(apiClient(), String(SEEDHA_API_BASE) + "/desk/ack")) return;
  http.addHeader("X-Device-Key", SEEDHA_DEVICE_KEY);
  http.addHeader("Content-Type", "application/json");
  if (http.POST(String(body.c_str())) == 200) core.ackSucceeded();
  http.end();
}

void pollOnce() {
  if (!ensureWifi()) return;  // offline: unsent acks stay queued
  HTTPClient http;
  http.setTimeout(seedha::kHttpTimeoutMs);
  if (!http.begin(apiClient(), String(SEEDHA_API_BASE) + "/desk/poll")) return;
  http.addHeader("X-Device-Key", SEEDHA_DEVICE_KEY);
  if (http.GET() == 200) {
    const String body = http.getString();
    core.handlePoll(std::string(body.c_str()));
  }
  http.end();
  sendAcks();
}

void readButton() {
  const int level = digitalRead(seedha::kButtonPin);
  const uint32_t now = millis();
  if (level == lastButtonLevel || now - lastButtonChangeMs < seedha::kDebounceMs) return;
  lastButtonChangeMs = now;
  lastButtonLevel = level;
  if (level == LOW) core.reprintLastSlip();
}

}  // namespace

void setup() {
  Serial.begin(115200);
  Serial2.begin(seedha::kPrinterBaud, SERIAL_8N1, seedha::kPrinterRxPin, seedha::kPrinterTxPin);
  pinMode(seedha::kButtonPin, INPUT_PULLUP);
  pinMode(seedha::kBuzzerPin, OUTPUT);
  ring.begin();
  ring.setBrightness(60);
  hardware.setRing(false);
  tft.init();
  tft.setRotation(1);
  hardware.idle();
  tls.setCACert(SEEDHA_ROOT_CA);
  ensureWifi();
}

void loop() {
  readButton();
  hardware.tick();
  if (millis() - lastPollMs >= seedha::kPollIntervalMs) {
    lastPollMs = millis();
    pollOnce();
  }
  delay(10);
}
