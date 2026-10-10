// Native tests for the Desk core. They replay a real /desk/poll response
// recorded from the Seedha API (test/fixtures/poll.json, see
// apps/api/tests/test_firmware_contract.py), so firmware and API agree.
#include <unity.h>

#include <fstream>
#include <sstream>
#include <string>
#include <vector>

#include "desk_core.h"

namespace {

struct FakeHardware : seedha::Hardware {
  std::vector<std::string> calls;
  std::string qrUrl;
  std::string qrText;
  std::string okText;
  std::string printed;
  bool ringGreen = false;

  void showQr(const std::string& url, const std::string& text) override {
    calls.push_back("show_qr");
    qrUrl = url;
    qrText = text;
  }
  void showOk(const std::string& text, const std::string& sub) override {
    calls.push_back("show_ok");
    okText = text + "|" + sub;
  }
  void showText(const std::string& text, const std::string& sub) override {
    calls.push_back("show_text:" + text + "|" + sub);
  }
  void showIdle() override { calls.push_back("show_idle"); }
  void setRing(bool green) override {
    calls.push_back(green ? "ring_green" : "ring_off");
    ringGreen = green;
  }
  void beep() override { calls.push_back("beep"); }
  void printSlip(const std::string& bytes) override {
    calls.push_back("print_slip");
    printed = bytes;
  }
};

std::string readFixture() {
  std::ifstream file("test/fixtures/poll.json");
  std::stringstream buffer;
  buffer << file.rdbuf();
  return buffer.str();
}

void test_replays_the_api_check_in_consent_checkout() {
  FakeHardware hw;
  seedha::DeskCore core(hw);
  const std::string json = readFixture();
  TEST_ASSERT_TRUE_MESSAGE(!json.empty(), "fixture missing: run the API contract test");
  TEST_ASSERT_EQUAL_INT(8, core.handlePoll(json));
  const std::vector<std::string> expected = {
      "ring_off", "show_qr", "show_ok", "ring_green", "beep",
      "show_text:Printing slip|Please take your receipt", "print_slip", "show_idle"};
  TEST_ASSERT_EQUAL_UINT(expected.size(), hw.calls.size());
  for (std::size_t i = 0; i < expected.size(); ++i) {
    TEST_ASSERT_EQUAL_STRING(expected[i].c_str(), hw.calls[i].c_str());
  }
  TEST_ASSERT_EQUAL_STRING("http://localhost:3000/consent/TOKEN", hw.qrUrl.c_str());
  TEST_ASSERT_EQUAL_STRING("Room 104, scan to get your perk", hw.qrText.c_str());
  TEST_ASSERT_EQUAL_STRING("Thank you, Neha ji|Consent saved", hw.okText.c_str());
  TEST_ASSERT_TRUE(hw.ringGreen);
  TEST_ASSERT_EQUAL_CHAR(0x1B, hw.printed[0]);
  TEST_ASSERT_EQUAL_CHAR('@', hw.printed[1]);
  TEST_ASSERT_TRUE(hw.printed.find("Hotel kept              Rs 2,678") != std::string::npos);
  TEST_ASSERT_TRUE(hw.printed.find("DEODAR-NG26") != std::string::npos);
  TEST_ASSERT_EQUAL_CHAR(0x1D, hw.printed[hw.printed.size() - 3]);
  TEST_ASSERT_EQUAL_CHAR('V', hw.printed[hw.printed.size() - 2]);
  TEST_ASSERT_EQUAL_STRING("{\"ids\":[1,2,3,4,5,6,7,8]}", core.ackBody().c_str());
}

void test_offline_ack_queue_and_no_double_run() {
  FakeHardware hw;
  seedha::DeskCore core(hw);
  const std::string json =
      R"({"commands":[{"id":41,"kind":"beep","payload":{}},{"id":42,"kind":"set_ring","payload":{"color":"green"}}]})";
  TEST_ASSERT_EQUAL_INT(2, core.handlePoll(json));
  // The ack is lost (network down): the API sends the same commands again.
  TEST_ASSERT_EQUAL_INT(0, core.handlePoll(json));
  TEST_ASSERT_EQUAL_UINT(2, hw.calls.size());
  TEST_ASSERT_EQUAL_UINT(2, core.pendingAcks());
  TEST_ASSERT_EQUAL_STRING("{\"ids\":[41,42]}", core.ackBody().c_str());
  core.ackSucceeded();
  TEST_ASSERT_EQUAL_UINT(0, core.pendingAcks());
  TEST_ASSERT_EQUAL_STRING("", core.ackBody().c_str());
}

void test_bad_input_is_harmless() {
  FakeHardware hw;
  seedha::DeskCore core(hw);
  TEST_ASSERT_EQUAL_INT(-1, core.handlePoll("not json"));
  TEST_ASSERT_EQUAL_INT(-1, core.handlePoll("{\"commands\":5}"));
  TEST_ASSERT_EQUAL_INT(1, core.handlePoll(R"({"commands":[{"id":7,"kind":"future_thing","payload":{}},{"kind":"beep"}]})"));
  TEST_ASSERT_EQUAL_UINT(0, hw.calls.size());
  TEST_ASSERT_EQUAL_STRING("{\"ids\":[7]}", core.ackBody().c_str());
}

void test_reprint_and_ascii() {
  FakeHardware hw;
  seedha::DeskCore core(hw);
  TEST_ASSERT_FALSE(core.reprintLastSlip());
  core.handlePoll(R"({"commands":[{"id":1,"kind":"print_slip","payload":{"text":"Café OK"}}]})");
  TEST_ASSERT_TRUE(hw.printed.find("Caf?? OK") != std::string::npos);
  hw.printed.clear();
  TEST_ASSERT_TRUE(core.reprintLastSlip());
  TEST_ASSERT_TRUE(hw.printed.find("Caf?? OK") != std::string::npos);
  TEST_ASSERT_EQUAL_STRING("Rs 2,678 - x ?", seedha::toDisplayAscii("₹2,678 · x न").c_str());
}

void test_seen_and_ack_buffers_are_bounded() {
  FakeHardware hw;
  seedha::DeskCore core(hw);
  for (int id = 1; id <= 100; ++id) {
    core.handlePoll("{\"commands\":[{\"id\":" + std::to_string(id) + ",\"kind\":\"beep\",\"payload\":{}}]}");
  }
  TEST_ASSERT_EQUAL_UINT(100, hw.calls.size());
  TEST_ASSERT_EQUAL_UINT(seedha::DeskCore::kAckCapacity, core.pendingAcks());
}

}  // namespace

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_replays_the_api_check_in_consent_checkout);
  RUN_TEST(test_offline_ack_queue_and_no_double_run);
  RUN_TEST(test_bad_input_is_harmless);
  RUN_TEST(test_reprint_and_ascii);
  RUN_TEST(test_seen_and_ack_buffers_are_bounded);
  return UNITY_END();
}
