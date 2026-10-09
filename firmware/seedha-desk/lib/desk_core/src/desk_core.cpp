#include "desk_core.h"

#include <ArduinoJson.h>

#include <algorithm>

namespace seedha {

namespace {
constexpr char kEsc = 0x1B;
constexpr char kGs = 0x1D;
}  // namespace

std::string escposSlip(const std::string& text) {
  std::string out;
  out.reserve(text.size() + 16);
  out += kEsc;
  out += '@';  // initialise
  for (char c : text) out += (static_cast<unsigned char>(c) < 0x80) ? c : '?';
  out += "\n\n\n\n";
  out += kGs;
  out += 'V';
  out += static_cast<char>(1);  // partial cut
  return out;
}

std::string toDisplayAscii(const std::string& utf8) {
  std::string out;
  out.reserve(utf8.size());
  for (std::size_t i = 0; i < utf8.size();) {
    const auto lead = static_cast<unsigned char>(utf8[i]);
    if (lead < 0x80) {
      out += static_cast<char>(lead);
      ++i;
      continue;
    }
    std::size_t len = (lead >= 0xF0) ? 4 : (lead >= 0xE0) ? 3 : 2;
    len = std::min(len, utf8.size() - i);
    const std::string seq = utf8.substr(i, len);
    if (seq == "\xC2\xB7" || seq == "\xE2\x80\x93" || seq == "\xE2\x80\x94" ||
        seq == "\xE2\x88\x92") {
      out += '-';
    } else if (seq == "\xE2\x82\xB9") {
      out += "Rs ";
    } else {
      out += '?';
    }
    i += len;
  }
  return out;
}

DeskCore::DeskCore(Hardware& hardware) : hardware_(hardware) {}

bool DeskCore::seen(int64_t id) const {
  return std::find(seen_.begin(), seen_.end(), id) != seen_.end();
}

void DeskCore::remember(int64_t id) {
  if (seen_.size() >= kSeenCapacity) seen_.erase(seen_.begin());
  seen_.push_back(id);
}

void DeskCore::queueAck(int64_t id) {
  if (std::find(pendingAcks_.begin(), pendingAcks_.end(), id) != pendingAcks_.end()) return;
  if (pendingAcks_.size() >= kAckCapacity) pendingAcks_.erase(pendingAcks_.begin());
  pendingAcks_.push_back(id);
}

void DeskCore::run(const std::string& kind, const std::string& url, const std::string& text,
                   const std::string& sub, const std::string& color) {
  if (kind == "show_qr") {
    hardware_.showQr(url, toDisplayAscii(text));
  } else if (kind == "show_ok") {
    hardware_.showOk(text.empty() ? "Thank you" : toDisplayAscii(text), toDisplayAscii(sub));
  } else if (kind == "show_text") {
    hardware_.showText(toDisplayAscii(text), toDisplayAscii(sub));
  } else if (kind == "show_idle") {
    hardware_.showIdle();
  } else if (kind == "set_ring") {
    hardware_.setRing(color == "green");
  } else if (kind == "beep") {
    hardware_.beep();
  } else if (kind == "print_slip") {
    lastSlip_ = escposSlip(text);
    hardware_.printSlip(lastSlip_);
  }
  // Unknown kinds are acknowledged and ignored, so a newer API cannot jam the box.
}

int DeskCore::handlePoll(const std::string& json) {
  JsonDocument doc;
  if (deserializeJson(doc, json) != DeserializationError::Ok) return -1;
  JsonArrayConst commands = doc["commands"].as<JsonArrayConst>();
  if (commands.isNull()) return -1;
  int ran = 0;
  for (JsonObjectConst command : commands) {
    const int64_t id = command["id"] | static_cast<int64_t>(-1);
    if (id < 0) continue;
    queueAck(id);
    if (seen(id)) continue;
    remember(id);
    JsonObjectConst payload = command["payload"];
    run(command["kind"] | "", payload["url"] | "", payload["text"] | "", payload["sub"] | "",
        payload["color"] | "");
    ++ran;
  }
  return ran;
}

std::string DeskCore::ackBody() const {
  if (pendingAcks_.empty()) return "";
  JsonDocument doc;
  JsonArray ids = doc["ids"].to<JsonArray>();
  for (int64_t id : pendingAcks_) ids.add(id);
  std::string out;
  serializeJson(doc, out);
  return out;
}

void DeskCore::ackSucceeded() { pendingAcks_.clear(); }

bool DeskCore::reprintLastSlip() {
  if (lastSlip_.empty()) return false;
  hardware_.printSlip(lastSlip_);
  return true;
}

}  // namespace seedha
