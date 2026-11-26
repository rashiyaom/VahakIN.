/**
 * VahakIN — SIM800L Internet Connectivity Test
 * =============================================
 * ESP32-S3  |  SIM800L EVB V2.0
 * Port: /dev/cu.usbmodem101  |  Baud: 115200
 *
 * WIRING (from assembly guide TABLE 1):
 *   SIM800L VCC → Buck A 5 V (separate supply, NOT USB 3.3 V)
 *   SIM800L GND → common GND
 *   SIM800L TX  → GPIO 17 (ESP32 RX1)   ← crossed
 *   SIM800L RX  → GPIO 18 (ESP32 TX1)
 *   SIM800L RST → not connected
 *   1000 µF + 100 nF bulk caps across SIM800L VCC/GND
 *
 * What this sketch does (in order):
 *   1. Autobaud sync (AT × 5)
 *   2. SIM card present?        AT+CPIN?
 *   3. SIM ICCID               AT+CCID
 *   4. Network operator name   AT+COPS?
 *   5. Signal quality           AT+CSQ  (RSSI dBm)
 *   6. GPRS registration        AT+CGREG?
 *   7. Auto-detect APN (tries Jio, Airtel, Vi, BSNL, Idea)
 *   8. GPRS attach              AT+CGATT=1
 *   9. Set APN                  AT+CSTT
 *  10. Bring up wireless        AT+CIICR
 *  11. Get IP address           AT+CIFSR
 *  12. HTTP GET → httpbin.org/get  (proves internet)
 *  13. Stream JSON every 5 s with live CSQ + IP
 *
 * Serial Monitor: 115200 baud
 * Also provides a "passthrough" mode — type AT commands in Serial Monitor.
 */

#include <Arduino.h>

// ── Pins ─────────────────────────────────────────────────────────────────────
#define SIM_RX    17
#define SIM_TX    18
#define SIM_BAUD  9600

HardwareSerial SIM(1);

// ── State ─────────────────────────────────────────────────────────────────────
struct SimState {
  bool   synced       = false;
  bool   sim_ready    = false;
  String iccid        = "";
  String operator_    = "";
  int    rssi         = -1;
  int    rssi_dbm     = -1;
  bool   gprs_reg     = false;
  bool   gprs_up      = false;
  String ip           = "";
  String apn          = "";
  bool   internet_ok  = false;
  String http_body    = "";
} state;

// ── Indian APN table ──────────────────────────────────────────────────────────
const char* APN_LIST[] = {
  "jionet",          // Reliance Jio
  "airtelgprs.com",  // Airtel
  "portalnmms",      // Vi / Vodafone Idea
  "bsnlnet",         // BSNL
  "mtnl.net",        // MTNL Delhi/Mumbai
  "internet",        // Generic fallback
};
const int APN_COUNT = 6;

// ── AT command helper ─────────────────────────────────────────────────────────
String simCmd(const char* cmd, uint32_t timeout_ms = 3000, bool raw = false) {
  while (SIM.available()) SIM.read();   // flush
  SIM.println(cmd);
  uint32_t t0 = millis();
  String resp = "";
  while (millis() - t0 < timeout_ms) {
    while (SIM.available()) {
      char c = SIM.read();
      resp += c;
    }
    if (!raw) {
      if (resp.indexOf("OK\r") >= 0 || resp.indexOf("OK\n") >= 0 ||
          resp.indexOf("ERROR") >= 0 || resp.indexOf(">") >= 0) break;
    }
    delay(5);
  }
  resp.trim();
  return resp;
}

bool simOK(const char* cmd, uint32_t timeout_ms = 3000) {
  return simCmd(cmd, timeout_ms).indexOf("OK") >= 0;
}

// Wait for unsolicited string (e.g. "CONNECT", "+PDP DEACT")
bool simWait(const char* expect, uint32_t timeout_ms = 8000) {
  uint32_t t0 = millis();
  String buf = "";
  while (millis() - t0 < timeout_ms) {
    while (SIM.available()) buf += (char)SIM.read();
    if (buf.indexOf(expect) >= 0) return true;
    delay(5);
  }
  return false;
}

// Extract value after "+TAG: " from response
String extract(String resp, const char* tag) {
  int idx = resp.indexOf(tag);
  if (idx < 0) return "";
  int start = idx + strlen(tag);
  int end   = resp.indexOf('\n', start);
  String val = (end < 0) ? resp.substring(start) : resp.substring(start, end);
  val.trim();
  val.replace("\"", "");
  return val;
}

int csqToDbm(int csq) {
  if (csq == 99 || csq < 0) return -999;
  return -113 + 2 * csq;
}

// ── STEP 1: Autobaud ──────────────────────────────────────────────────────────
bool autobaud() {
  Serial.println("[SIM] Autobaud sync...");
  for (int i = 0; i < 6; i++) {
    SIM.println("AT");
    delay(600);
    String r = "";
    while (SIM.available()) r += (char)SIM.read();
    if (r.indexOf("OK") >= 0 || r.indexOf("AT") >= 0) {
      simOK("ATE0");     // echo off
      simOK("AT+CMEE=2"); // verbose errors
      Serial.println("[SIM] ✓ Module responding");
      return true;
    }
    Serial.printf("[SIM]  attempt %d/6 — no response\n", i+1);
    delay(500);
  }
  return false;
}

// ── STEP 2–3: SIM card ───────────────────────────────────────────────────────
void checkSIM() {
  Serial.println("\n[SIM] Checking SIM card...");
  
  // Wait up to 10 s for SIM to settle
  for (int i = 0; i < 10; i++) {
    String cpin = simCmd("AT+CPIN?", 3000);
    if (cpin.indexOf("READY") >= 0) {
      state.sim_ready = true;
      Serial.println("[SIM] ✓ SIM card: READY (unlocked)");
      break;
    } else if (cpin.indexOf("SIM PIN") >= 0) {
      Serial.println("[SIM] ✗ SIM is PIN-locked — unlock it first");
      break;
    } else if (cpin.indexOf("NO SIM") >= 0 || cpin.indexOf("SIM not inserted") >= 0) {
      Serial.println("[SIM] ✗ NO SIM DETECTED — check insertion");
      break;
    }
    Serial.printf("[SIM]  CPIN not ready yet (%d/10)...\n", i+1);
    delay(1000);
  }

  if (state.sim_ready) {
    // ICCID
    String ccid = simCmd("AT+CCID", 2000);
    int ci = ccid.indexOf("+CCID:");
    if (ci < 0) ci = ccid.indexOf("CCID:");
    if (ci >= 0) {
      state.iccid = ccid.substring(ci + 6);
      state.iccid.trim();
      state.iccid.replace("\"","");
    } else {
      // Some modules return ICCID directly
      ccid.replace("OK",""); ccid.trim();
      if (ccid.length() > 10) state.iccid = ccid;
    }
    Serial.printf("[SIM] ICCID: %s\n", state.iccid.c_str());
  }
}

// ── STEP 4–5: Network ────────────────────────────────────────────────────────
void checkNetwork() {
  Serial.println("\n[SIM] Checking network...");

  // Wait for registration (up to 30 s)
  Serial.print("[SIM] Waiting for GSM registration");
  for (int i = 0; i < 30; i++) {
    String creg = simCmd("AT+CREG?", 2000);
    if (creg.indexOf(",1") >= 0 || creg.indexOf(",5") >= 0 ||
        creg.indexOf(": 1") >= 0 || creg.indexOf(": 5") >= 0) {
      Serial.println(" ✓");
      break;
    }
    Serial.print(".");
    delay(1000);
  }

  // Operator name
  String cops = simCmd("AT+COPS?", 5000);
  state.operator_ = extract(cops, "+COPS: 0,0,\"");
  if (state.operator_.isEmpty()) {
    // Numeric mode fallback
    int oi = cops.indexOf(",\"");
    if (oi >= 0) { state.operator_ = cops.substring(oi+2); state.operator_.replace("\"",""); state.operator_.trim(); }
  }
  Serial.printf("[SIM] Operator : %s\n", state.operator_.isEmpty() ? "(unknown)" : state.operator_.c_str());

  // Signal quality
  String csq = simCmd("AT+CSQ", 2000);
  int ci = csq.indexOf("+CSQ:");
  if (ci < 0) ci = csq.indexOf("CSQ:");
  if (ci >= 0) {
    String part = csq.substring(ci + 5);
    state.rssi = part.substring(0, part.indexOf(",")).toInt();
    state.rssi_dbm = csqToDbm(state.rssi);
  }
  String sigBar = "";
  if (state.rssi_dbm < -110) sigBar = "▂___  Very weak";
  else if (state.rssi_dbm < -100) sigBar = "▂▄__  Weak";
  else if (state.rssi_dbm < -90)  sigBar = "▂▄▆_  Moderate";
  else if (state.rssi_dbm < -80)  sigBar = "▂▄▆█  Good";
  else                              sigBar = "▂▄▆█+ Excellent";
  Serial.printf("[SIM] Signal   : CSQ=%d  %d dBm  %s\n", state.rssi, state.rssi_dbm, sigBar.c_str());
}

// ── STEP 6–12: GPRS + Internet ───────────────────────────────────────────────
bool tryAPN(const char* apn) {
  Serial.printf("[SIM] Trying APN: %s\n", apn);

  // Close any existing connection
  simCmd("AT+CIPSHUT", 5000);
  delay(500);

  // Detach then re-attach GPRS
  simOK("AT+CGATT=0", 5000);
  delay(1000);
  if (!simOK("AT+CGATT=1", 10000)) {
    Serial.println("[SIM]  GPRS attach failed");
    return false;
  }

  // Set APN (no user/pass for Indian carriers)
  String cstt = String("AT+CSTT=\"") + apn + "\"";
  if (!simOK(cstt.c_str(), 5000)) {
    Serial.println("[SIM]  AT+CSTT failed");
    return false;
  }

  // Bring up wireless connection
  Serial.println("[SIM]  AT+CIICR (connecting, up to 20 s)...");
  if (!simOK("AT+CIICR", 20000)) {
    Serial.println("[SIM]  AT+CIICR failed");
    simCmd("AT+CIPSHUT", 5000);
    return false;
  }

  // Get IP
  delay(500);
  String ip = simCmd("AT+CIFSR", 3000);
  ip.replace("AT+CIFSR",""); ip.replace("OK",""); ip.trim();
  if (ip.isEmpty() || ip.indexOf("ERROR") >= 0 || ip.indexOf("0.0.0.0") >= 0) {
    Serial.println("[SIM]  No IP assigned");
    simCmd("AT+CIPSHUT", 5000);
    return false;
  }
  state.ip  = ip;
  state.apn = apn;
  state.gprs_up = true;
  Serial.printf("[SIM] ✓ IP Address: %s\n", ip.c_str());
  return true;
}

bool testInternet() {
  Serial.println("\n[SIM] Testing HTTP (httpbin.org/get)...");

  // Single connection mode
  simOK("AT+CIPMUX=0", 2000);

  // Open TCP connection
  String conn = "AT+CIPSTART=\"TCP\",\"httpbin.org\",\"80\"";
  String r = simCmd(conn.c_str(), 15000);
  if (r.indexOf("CONNECT") < 0 && r.indexOf("OK") < 0) {
    Serial.printf("[SIM]  CIPSTART failed: %s\n", r.c_str());
    return false;
  }
  delay(500);

  // Send HTTP GET
  String req = "GET /get HTTP/1.1\r\nHost: httpbin.org\r\nConnection: close\r\n\r\n";
  SIM.print("AT+CIPSEND=");
  SIM.println(req.length());
  delay(500);
  while (SIM.available()) SIM.read();  // consume prompt
  SIM.print(req);

  // Read response (up to 15 s)
  uint32_t t0 = millis();
  String resp = "";
  while (millis() - t0 < 15000) {
    while (SIM.available()) resp += (char)SIM.read();
    if (resp.indexOf("CLOSED") >= 0 || resp.indexOf("\"origin\"") >= 0) break;
    delay(50);
  }

  if (resp.indexOf("HTTP/1.1 200") >= 0 || resp.indexOf("\"origin\"") >= 0) {
    // Extract our public IP from JSON
    int oi = resp.indexOf("\"origin\": \"");
    if (oi >= 0) {
      String pubip = resp.substring(oi + 11);
      pubip = pubip.substring(0, pubip.indexOf("\""));
      state.http_body = "Public IP: " + pubip;
      Serial.printf("[SIM] ✓ INTERNET OK — Public IP: %s\n", pubip.c_str());
    } else {
      state.http_body = "HTTP 200 received";
      Serial.println("[SIM] ✓ INTERNET OK — HTTP 200 received");
    }
    return true;
  }

  Serial.printf("[SIM] ✗ HTTP failed. Response snippet: %.120s\n", resp.c_str());
  return false;
}

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1500);

  Serial.println("\n╔═══════════════════════════════════════╗");
  Serial.println("║  VahakIN — SIM800L Internet Test v1.0 ║");
  Serial.println("╚═══════════════════════════════════════╝");
  Serial.printf("Port: /dev/cu.usbmodem101  |  %lu MHz\n\n", ESP.getCpuFreqMHz());

  SIM.begin(SIM_BAUD, SERIAL_8N1, SIM_RX, SIM_TX);
  delay(1000);

  // ── 1. Autobaud ──────────────────────────────────────────────────────────
  state.synced = autobaud();
  if (!state.synced) {
    Serial.println("\n[SIM] ✗ FAIL: Module not responding.");
    Serial.println("  → Check: 5 V on SIM800L VCC (not 3.3 V)");
    Serial.println("  → Check: TX→GPIO17, RX→GPIO18 (crossed)");
    Serial.println("  → Check: Common GND between ESP and SIM800L");
    Serial.println("  → Check: SIM800L PWR LED blinking (network search)");
    return;
  }

  // ── 2–3. SIM card ────────────────────────────────────────────────────────
  checkSIM();

  if (!state.sim_ready) {
    Serial.println("\n[SIM] ✗ FAIL: SIM card not ready.");
    Serial.println("  → Ensure card is fully inserted (gold contacts down)");
    Serial.println("  → Try the SIM in a phone first to confirm it works");
    return;
  }

  // ── 4–5. Network ─────────────────────────────────────────────────────────
  checkNetwork();

  // ── 6–8. GPRS ────────────────────────────────────────────────────────────
  Serial.println("\n[SIM] Setting up GPRS...");
  Serial.println("[SIM] Note: SIM800L supports 2G (GSM/GPRS) only");

  bool gprs_found = false;
  for (int i = 0; i < APN_COUNT && !gprs_found; i++) {
    gprs_found = tryAPN(APN_LIST[i]);
  }

  if (!gprs_found) {
    Serial.println("\n[SIM] ✗ GPRS connection failed with all APNs.");
    Serial.println("  → Confirm 2G network available in your area");
    Serial.println("  → Some carriers require a specific APN — check your SIM");
    Serial.println("  → SIM800L is 2G only; Jio 4G SIM will NOT work (no 2G)");
  }

  // ── 9–12. Internet ───────────────────────────────────────────────────────
  if (state.gprs_up) {
    state.internet_ok = testInternet();
    simCmd("AT+CIPSHUT", 5000);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  Serial.println("\n╔═══════════════════════════════════╗");
  Serial.println("║           FINAL SUMMARY           ║");
  Serial.println("╠═══════════════════════════════════╣");
  Serial.printf( "║  Module synced  : %s\n", state.synced       ? "✓ YES" : "✗ NO ");
  Serial.printf( "║  SIM detected   : %s\n", state.sim_ready    ? "✓ YES" : "✗ NO ");
  Serial.printf( "║  SIM ICCID      : %-18s\n", state.iccid.isEmpty()?"(unknown)":state.iccid.c_str());
  Serial.printf( "║  Operator       : %-18s\n", state.operator_.isEmpty()?"(unknown)":state.operator_.c_str());
  Serial.printf( "║  Signal (dBm)   : %-4d  CSQ=%d\n", state.rssi_dbm, state.rssi);
  Serial.printf( "║  GPRS up        : %s\n", state.gprs_up      ? "✓ YES" : "✗ NO ");
  Serial.printf( "║  APN used       : %-18s\n", state.apn.isEmpty()?"(none)":state.apn.c_str());
  Serial.printf( "║  IP Address     : %-18s\n", state.ip.isEmpty()?"(none)":state.ip.c_str());
  Serial.printf( "║  Internet (HTTP): %s\n", state.internet_ok  ? "✓ YES" : "✗ NO ");
  if (!state.http_body.isEmpty())
  Serial.printf( "║  %s\n", state.http_body.c_str());
  Serial.println("╚═══════════════════════════════════╝\n");
  Serial.println(">> Streaming JSON every 5 s. Type AT commands to SIM800L:\n");
}

// ── Loop: live JSON stream + serial passthrough ───────────────────────────────
void loop() {
  // Passthrough: USB Serial → SIM800L
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      Serial.printf("[TX] %s\n", line.c_str());
      SIM.println(line);
    }
  }

  // Print live response from SIM800L
  while (SIM.available()) {
    String r = SIM.readStringUntil('\n');
    r.trim();
    if (r.length() > 0) Serial.printf("[SIM] %s\n", r.c_str());
  }

  // JSON heartbeat every 5 s
  static uint32_t last_json = 0;
  if (millis() - last_json > 5000) {
    last_json = millis();

    // Refresh CSQ
    String csq = simCmd("AT+CSQ", 1500);
    int ci = csq.indexOf("+CSQ:");
    if (ci >= 0) {
      String part = csq.substring(ci + 5);
      state.rssi = part.substring(0, part.indexOf(",")).toInt();
      state.rssi_dbm = csqToDbm(state.rssi);
    }

    Serial.printf(
      "{\"sim800\":{\"synced\":%s,\"sim\":%s,\"operator\":\"%s\","
      "\"iccid\":\"%s\",\"rssi_dbm\":%d,\"csq\":%d,\"gprs\":%s,"
      "\"ip\":\"%s\",\"apn\":\"%s\",\"internet\":%s},\"ms\":%lu}\n",
      state.synced      ? "true":"false",
      state.sim_ready   ? "true":"false",
      state.operator_.c_str(),
      state.iccid.c_str(),
      state.rssi_dbm, state.rssi,
      state.gprs_up     ? "true":"false",
      state.ip.c_str(),
      state.apn.c_str(),
      state.internet_ok ? "true":"false",
      millis()
    );
  }
}
