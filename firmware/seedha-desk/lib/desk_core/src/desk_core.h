// Seedha Desk core: everything that does not touch hardware, so it can be
// unit-tested on a laptop. The firmware's main.cpp implements `Hardware`.
//
// Protocol (same as the browser simulator, CLAUDE.md M5):
//   GET  /desk/poll  (X-Device-Key)  -> {"commands":[{"id":1,"kind":"show_qr","payload":{...}}]}
//   POST /desk/ack   {"ids":[1,2]}
// Kinds: show_qr, show_ok, show_text, show_idle, set_ring, beep, print_slip.
// The box never receives guest contact data: only display text, a consent URL
// and slip text.
#pragma once

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace seedha {

class Hardware {
 public:
  virtual ~Hardware() = default;
  virtual void showQr(const std::string& url, const std::string& text) = 0;
  virtual void showOk(const std::string& text, const std::string& sub) = 0;
  virtual void showText(const std::string& text, const std::string& sub) = 0;
  virtual void showIdle() = 0;
  virtual void setRing(bool green) = 0;
  virtual void beep() = 0;
  virtual void printSlip(const std::string& escposBytes) = 0;
};

// Wraps plain slip text in ESC/POS: initialise, text, feed, partial cut.
// Any byte outside ASCII becomes '?' (the printer uses a single-byte code page).
std::string escposSlip(const std::string& text);

// UTF-8 text for the ASCII-only TFT fonts: a middle dot or dash becomes '-',
// a rupee sign "Rs ", any other non-ASCII character '?'.
std::string toDisplayAscii(const std::string& utf8);

class DeskCore {
 public:
  static constexpr std::size_t kSeenCapacity = 64;
  static constexpr std::size_t kAckCapacity = 64;

  explicit DeskCore(Hardware& hardware);

  // Runs every new command in a poll response. Returns how many ran, or -1
  // if the JSON could not be read. Commands seen before are not run again
  // (an ack can be lost while offline) but are acknowledged again.
  int handlePoll(const std::string& json);

  // JSON body for POST /desk/ack, or "" when nothing is waiting.
  std::string ackBody() const;
  // Call after the API accepted the ack body.
  void ackSucceeded();
  std::size_t pendingAcks() const { return pendingAcks_.size(); }

  // The last printed slip, for the reprint button.
  const std::string& lastSlip() const { return lastSlip_; }
  bool reprintLastSlip();

 private:
  bool seen(int64_t id) const;
  void remember(int64_t id);
  void queueAck(int64_t id);
  void run(const std::string& kind, const std::string& url, const std::string& text,
           const std::string& sub, const std::string& color);

  Hardware& hardware_;
  std::vector<int64_t> seen_;
  std::vector<int64_t> pendingAcks_;
  std::string lastSlip_;
};

}  // namespace seedha
