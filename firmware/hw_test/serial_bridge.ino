/**
 * VahakIN — SIM800L UART Pin Diagnostic + Bridge
 * ================================================
 * Flash this to ESP32-S3, then open Serial Monitor at 115200.
 * It will:
 *   1. Print "BRIDGE_READY" so you know it's running
 *   2. Drive TX pin HIGH/LOW and report voltage states
 *   3. Listen on RX pin and report any incoming bytes
 *   4. Try all baud rates (auto-detect)
 *   5. Act as full USB↔SIM800L passthrough
 *
 * Board  : ESP32S3 Dev Module
 * USB CDC on Boot: ENABLED  ← critical
 * Port   : /dev/cu.usbmodem101
 *
 * WIRING check (assembly guide TABLE 1):
 *   SIM800L TX  →  GPIO 17  (ESP RX1)
 *   SIM800L RX  →  GPIO 18  (ESP TX1)
 *   SIM800L VCC →  5 V from Buck A  (NOT 3.3 V!)
 *   SIM800L GND →  common GND with ESP
 */

#include <Arduino.h>

#define SIM_RX_PIN  17   // ESP receives FROM SIM800L TX
#define SIM_TX_PIN  18   // ESP transmits TO  SIM800L RX
#define LED_PIN      2   // Onboard LED (if present)

HardwareSerial SIM(1);

// ── Helpers ──────────────────────────────────────────────────────────────────
void printSep(const char* title) {
  Serial.printf("\n─── %s ─────────────────────────────\n", title);
}

String readSIM(uint32_t ms) {
  uint32_t t = millis();
  String r = "";
  while (millis() - t < ms) {
    while (SIM.available()) r += (char)SIM.read();
    delay(5);
  }
  return r;
}

bool trySend(const char* cmd, uint32_t wait_ms = 1500) {
  while (SIM.available()) SIM.read();
  SIM.print(cmd); SIM.print("\r\n");
  String r = readSIM(wait_ms);
  r.trim();
  Serial.printf("  TX: %-12s  RX: %s\n", cmd, r.isEmpty() ? "(nothing)" : r.c_str());
  return r.indexOf("OK") >= 0;
}

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1500);
  Serial.println("\n========================================");
  Serial.println("  VahakIN  SIM800L  Pin Diagnostic v2");
  Serial.println("========================================");
  Serial.printf("  ESP32-S3  |  %u MHz  |  %u B heap\n", ESP.getCpuFreqMHz(), ESP.getFreeHeap());
  Serial.println("BRIDGE_READY");
  Serial.println();

  // ── TEST 1: Pin state before UART init ────────────────────────────────────
  printSep("TEST 1: GPIO state before UART init");
  Serial.printf("  GPIO %d (SIM_RX) configured as: ", SIM_RX_PIN);
  pinMode(SIM_RX_PIN, INPUT_PULLUP);
  delay(10);
  int rx_hi = digitalRead(SIM_RX_PIN);
  pinMode(SIM_RX_PIN, INPUT_PULLDOWN);
  delay(10);
  int rx_lo = digitalRead(SIM_RX_PIN);
  if (rx_hi == HIGH && rx_lo == LOW) {
    Serial.println("FLOATING (nothing driving it — wire may be disconnected)");
  } else if (rx_hi == HIGH && rx_lo == HIGH) {
    Serial.println("DRIVEN HIGH (SIM800L TX is idle HIGH — GOOD sign!)");
  } else if (rx_hi == LOW && rx_lo == LOW) {
    Serial.println("DRIVEN LOW (unusual — check for short to GND)");
  } else {
    Serial.printf("  pull_up=%d pull_dn=%d\n", rx_hi, rx_lo);
  }
  pinMode(SIM_RX_PIN, INPUT);  // restore

  // ── TEST 2: Drive TX and announce ─────────────────────────────────────────
  printSep("TEST 2: ESP TX pin (GPIO 18 -> SIM800L RX)");
  Serial.printf("  GPIO %d is ESP TX → goes to SIM800L RX\n", SIM_TX_PIN);
  Serial.println("  (This is an output — cannot read back without loopback)");
  Serial.println("  With multimeter: GPIO18 should be ~3.3V at idle (UART mark state)");

  // ── TEST 3: Baud sweep ─────────────────────────────────────────────────────
  printSep("TEST 3: Baud rate sweep — AT command");
  int bauds[] = {9600, 115200, 19200, 38400, 4800, 57600, 2400};
  int found = -1;
  for (int b : bauds) {
    SIM.begin(b, SERIAL_8N1, SIM_RX_PIN, SIM_TX_PIN);
    delay(100);
    while (SIM.available()) SIM.read();
    SIM.print("AT\r\n");
    delay(600);
    String r = "";
    while (SIM.available()) r += (char)SIM.read();
    r.trim();
    if (!r.isEmpty()) {
      Serial.printf("  %6d baud -> RESPONSE: %s\n", b, r.c_str());
      found = b;
      break;
    } else {
      Serial.printf("  %6d baud -> (silent)\n", b);
    }
    SIM.end();
    delay(100);
  }

  // ── TEST 4: Loopback test (TX→RX short) ───────────────────────────────────
  printSep("TEST 4: UART loopback test");
  Serial.println("  To isolate ESP vs SIM800L: short GPIO17 to GPIO18 with a wire.");
  Serial.println("  Then observe the loopback result below:");
  SIM.begin(9600, SERIAL_8N1, SIM_RX_PIN, SIM_TX_PIN);
  delay(100);
  while (SIM.available()) SIM.read();
  SIM.print("LOOP");
  delay(200);
  String loop_r = "";
  while (SIM.available()) loop_r += (char)SIM.read();
  if (loop_r.indexOf("LOOP") >= 0) {
    Serial.println("  Loopback: PASS (ESP32 UART hardware OK, wire short works)");
  } else {
    Serial.printf("  Loopback: FAIL (got: '%s')\n", loop_r.c_str());
    Serial.println("  -> Without short: expected FAIL — ESP32 UART is fine");
    Serial.println("  -> If FAIL *with* short: ESP32 UART hardware problem");
  }

  // ── TEST 5: Listen for SIM800L boot ───────────────────────────────────────
  printSep("TEST 5: Passive listen 10 s (power-cycle SIM800L NOW)");
  Serial.println("  Watching for any SIM800L output at 9600 baud...");
  SIM.begin(9600, SERIAL_8N1, SIM_RX_PIN, SIM_TX_PIN);
  uint32_t t0 = millis();
  String boot = "";
  while (millis() - t0 < 10000) {
    while (SIM.available()) {
      char c = SIM.read();
      boot += c;
      Serial.printf("[SIM_RAW] 0x%02X '%c'\n", (uint8_t)c,
                    (c >= 32 && c < 127) ? c : '.');
    }
    delay(10);
  }
  if (boot.isEmpty()) {
    Serial.println("  NOTHING received in 10 s.");
    Serial.println("  -> SIM800L is either powered OFF or TX wire not connected");
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  printSep("SUMMARY");
  if (found > 0) {
    Serial.printf("  SIM800L responded at %d baud!\n", found);
    Serial.println("  Run send_sms.py now.\n");
  } else {
    Serial.println("  SIM800L did NOT respond.\n");
    Serial.println("  PHYSICAL CHECKS (do these in order):\n");
    Serial.println("  1. POWER LED check:");
    Serial.println("     SIM800L red LED blinking every 3s = good");
    Serial.println("     LED off = no power. Needs 5V from external supply.");
    Serial.println();
    Serial.println("  2. VOLTAGE check with multimeter:");
    Serial.println("     SIM800L VCC pin -> 4.75-5.25 V");
    Serial.println("     GPIO 17 at idle -> ~3.3 V (SIM800L TX idles HIGH)");
    Serial.println("     GPIO 18 at idle -> ~3.3 V (UART TX idle state)");
    Serial.println();
    Serial.println("  3. WIRING check:");
    Serial.println("     SIM800L TX  -> GPIO 17  (orange/yellow wire)");
    Serial.println("     SIM800L RX  -> GPIO 18  (green wire)");
    Serial.println("     SIM800L GND -> ESP32 GND (must be SAME ground)");
    Serial.println();
    Serial.println("  4. SIM CARD check:");
    Serial.println("     Gold contacts face DOWN");
    Serial.println("     Card clicks into holder (don't just lay it on)");
    Serial.println();
    Serial.println("  5. If using Jio SIM:");
    Serial.println("     Jio shut down 2G. SIM800L is 2G only.");
    Serial.println("     Use Airtel, Vi, or BSNL SIM instead.");
  }

  Serial.println("\n========================================");
  Serial.println("  Passthrough mode: type AT commands");
  Serial.println("========================================\n");
}

// ── Loop: full USB↔SIM passthrough ───────────────────────────────────────────
void loop() {
  while (Serial.available()) {
    char c = Serial.read();
    SIM.write(c);
  }
  while (SIM.available()) {
    char c = SIM.read();
    Serial.write(c);
  }
}
