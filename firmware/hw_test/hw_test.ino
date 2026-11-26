/**
 * VahakIN — ESP32-S3 Hardware Connection Test
 * ============================================
 * Tests:  MPU-6050 IMU (I2C)  |  SIM800L (UART1)  |  A6 NEO GSM (UART2)
 * Board:  ESP32-S3 DevKitC-1 / WROOM-1
 * Port:   /dev/cu.usbmodem101
 *
 * === WIRING ASSUMED (edit pin defines if yours differ) ===
 *
 *  MPU-6050 (I2C)
 *    VCC  → 3.3 V
 *    GND  → GND
 *    SDA  → GPIO 8  (default ESP32-S3 I2C SDA)
 *    SCL  → GPIO 9  (default ESP32-S3 I2C SCL)
 *    AD0  → GND     (I2C addr = 0x68)
 *    INT  → (not used in this test)
 *
 *  SIM800L EVB V2.0 (UART1)       ← from assembly guide TABLE 1
 *    VCC  → Buck A 5 V (separate short leads — NOT 3.3 V!)
 *    GND  → common GND
 *    TX   → GPIO 17  (ESP32 RX1)   ← cross UART
 *    RX   → GPIO 18  (ESP32 TX1)
 *    RST  → not connected (initial test)
 *    Bulk → 1000 µF + 100 nF across VCC/GND at module
 *
 *  NEO-6M GPS (UART2)             ← from assembly guide TABLE 1
 *    VCC  → verified 3.3 V
 *    GND  → GND
 *    TX   → GPIO 16  (receive NMEA only)
 *    RX   → not connected (read-only)
 *
 *  A6 NEO GSM — NOTE: assembly guide uses SIM800L EVB V2.0.
 *  If you have an A6 module as well, wire it on UART2:
 *    TXD  → GPIO 20  (ESP32 RX2)
 *    RXD  → GPIO 21  (ESP32 TX2)
 *
 * Serial Monitor: 115200 baud
 * JSON output every second for the HTML dashboard.
 */

#include <Arduino.h>
#include <Wire.h>

// ─── Pin Definitions ─────────────────────────────────────────────────────────
#define IMU_SDA        8
#define IMU_SCL        9
#define IMU_ADDR       0x68   // AD0 LOW → 0x68, AD0 HIGH → 0x69

// From assembly guide TABLE 1 (confirmed GPIO map)
#define SIM800_RX      17     // ESP32 receives from SIM800 TX
#define SIM800_TX      18     // ESP32 transmits to SIM800 RX
#define SIM800_RST     -1     // Not connected in initial test
#define SIM800_BAUD    9600

#define GPS_RX         16     // NEO-6M TX → GPIO16 (NMEA receive)
#define GPS_TX         -1     // Not connected
#define GPS_BAUD       9600

// If you have A6 NEO as a second module:
#define A6_RX          20
#define A6_TX          21
#define A6_RST         19
#define A6_BAUD        115200

// ─── MPU-6050 Registers ──────────────────────────────────────────────────────
#define MPU_WHO_AM_I   0x75
#define MPU_PWR_MGMT_1 0x6B
#define MPU_ACCEL_XOUT 0x3B
#define MPU_GYRO_XOUT  0x43
#define MPU_CONFIG     0x1A
#define MPU_GYRO_CFG   0x1B  // ±250 °/s
#define MPU_ACCEL_CFG  0x1C  // ±2 g
#define MPU_SMPLRT_DIV 0x19

// ─── Globals ─────────────────────────────────────────────────────────────────
HardwareSerial SIM800(1);
HardwareSerial GPS_SER(2);    // NEO-6M on UART2
HardwareSerial A6(0);         // A6 NEO if present (UART0 is shared with Serial, use with care)

struct ImuData {
  float ax, ay, az;   // g
  float gx, gy, gz;   // °/s
  float temp;          // °C
  bool  ok;
};

bool sim800_ok = false;
bool a6_ok     = false;
bool imu_ok    = false;

// ─── Helpers ─────────────────────────────────────────────────────────────────
void writeReg(uint8_t addr, uint8_t reg, uint8_t val) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}

uint8_t readReg(uint8_t addr, uint8_t reg) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(addr, (uint8_t)1);
  return Wire.available() ? Wire.read() : 0xFF;
}

void readBytes(uint8_t addr, uint8_t reg, uint8_t *buf, uint8_t len) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(addr, len);
  for (uint8_t i = 0; i < len && Wire.available(); i++) buf[i] = Wire.read();
}

int16_t to16(uint8_t hi, uint8_t lo) { return (int16_t)((hi << 8) | lo); }

// Send AT command, wait for response, return true if keyword found
bool atCmd(HardwareSerial &port, const char *cmd, const char *expect,
           uint32_t timeout_ms = 2000) {
  while (port.available()) port.read();   // flush
  port.println(cmd);
  uint32_t t = millis();
  String resp = "";
  while (millis() - t < timeout_ms) {
    while (port.available()) {
      char c = port.read();
      resp += c;
    }
    if (resp.indexOf(expect) >= 0) return true;
  }
  return false;
}

// ─── IMU Init ─────────────────────────────────────────────────────────────────
bool initIMU() {
  Wire.begin(IMU_SDA, IMU_SCL);
  Wire.setClock(400000);
  delay(100);

  uint8_t whoami = readReg(IMU_ADDR, MPU_WHO_AM_I);
  Serial.printf("[IMU] WHO_AM_I = 0x%02X (expect 0x68)\n", whoami);
  if (whoami != 0x68 && whoami != 0x70) return false;

  writeReg(IMU_ADDR, MPU_PWR_MGMT_1, 0x00); // Wake
  delay(10);
  writeReg(IMU_ADDR, MPU_SMPLRT_DIV, 0x07); // 1 kHz / 8 = 125 Hz
  writeReg(IMU_ADDR, MPU_CONFIG,     0x06); // DLPF 5 Hz
  writeReg(IMU_ADDR, MPU_GYRO_CFG,  0x00); // ±250 °/s
  writeReg(IMU_ADDR, MPU_ACCEL_CFG, 0x00); // ±2 g
  return true;
}

ImuData readIMU() {
  ImuData d{};
  uint8_t raw[14];
  readBytes(IMU_ADDR, MPU_ACCEL_XOUT, raw, 14);

  d.ax   = to16(raw[0],  raw[1])  / 16384.0f;
  d.ay   = to16(raw[2],  raw[3])  / 16384.0f;
  d.az   = to16(raw[4],  raw[5])  / 16384.0f;
  d.temp = to16(raw[6],  raw[7])  / 340.0f + 36.53f;
  d.gx   = to16(raw[8],  raw[9])  / 131.0f;
  d.gy   = to16(raw[10], raw[11]) / 131.0f;
  d.gz   = to16(raw[12], raw[13]) / 131.0f;
  d.ok   = true;
  return d;
}

// ─── SIM800L Handshake ────────────────────────────────────────────────────────
bool initSIM800() {
  Serial.println("[SIM800] Resetting...");
  pinMode(SIM800_RST, OUTPUT);
  digitalWrite(SIM800_RST, LOW);  delay(200);
  digitalWrite(SIM800_RST, HIGH); delay(3000);

  SIM800.begin(SIM800_BAUD, SERIAL_8N1, SIM800_RX, SIM800_TX);

  // Auto-baud sync: send AT 3 times
  for (int i = 0; i < 3; i++) {
    if (atCmd(SIM800, "AT", "OK", 1500)) {
      Serial.println("[SIM800] AT → OK ✓");
      break;
    }
    delay(500);
  }

  String cmds[][2] = {
    {"ATE0",        "OK"},  // Echo off
    {"AT+CMEE=2",   "OK"},  // Verbose errors
    {"AT+CPIN?",    "READY"},
    {"AT+CSQ",      "CSQ"},
    {"AT+CREG?",    "+CREG"},
    {"AT+CGATT?",   "+CGATT"},
  };

  bool pass = true;
  for (auto &c : cmds) {
    bool ok = atCmd(SIM800, c[0].c_str(), c[1].c_str(), 3000);
    Serial.printf("[SIM800] %-12s → %s\n", c[0].c_str(), ok ? "OK ✓" : "FAIL ✗");
    if (!ok) pass = false;
  }

  // Read signal quality
  while (SIM800.available()) SIM800.read();
  SIM800.println("AT+CSQ");
  delay(500);
  String csq = ""; while (SIM800.available()) csq += (char)SIM800.read();
  Serial.printf("[SIM800] CSQ response: %s\n", csq.c_str());

  return pass;
}

// ─── A6 NEO Handshake ─────────────────────────────────────────────────────────
bool initA6() {
  Serial.println("[A6] Resetting...");
  pinMode(A6_RST, OUTPUT);
  digitalWrite(A6_RST, LOW);  delay(200);
  digitalWrite(A6_RST, HIGH); delay(3000);

  A6.begin(A6_BAUD, SERIAL_8N1, A6_RX, A6_TX);

  for (int i = 0; i < 3; i++) {
    if (atCmd(A6, "AT", "OK", 1500)) {
      Serial.println("[A6] AT → OK ✓");
      break;
    }
    delay(500);
  }

  String cmds[][2] = {
    {"ATE0",      "OK"},
    {"AT+CGMM",   "OK"},   // Model identifier
    {"AT+CPIN?",  "READY"},
    {"AT+CSQ",    "CSQ"},
    {"AT+CREG?",  "+CREG"},
  };

  bool pass = true;
  for (auto &c : cmds) {
    bool ok = atCmd(A6, c[0].c_str(), c[1].c_str(), 3000);
    Serial.printf("[A6] %-12s → %s\n", c[0].c_str(), ok ? "OK ✓" : "FAIL ✗");
    if (!ok) pass = false;
  }

  while (A6.available()) A6.read();
  A6.println("AT+CGMM");
  delay(500);
  String model = ""; while (A6.available()) model += (char)A6.read();
  model.trim();
  Serial.printf("[A6] Model: %s\n", model.c_str());

  return pass;
}

// ─── Setup ───────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1500);

  Serial.println("\n========================================");
  Serial.println("  VahakIN  ESP32-S3 Hardware Test v1.0");
  Serial.println("========================================");
  Serial.printf("  Board     : ESP32-S3 (Espressif)\n");
  Serial.printf("  Port      : /dev/cu.usbmodem101\n");
  Serial.printf("  Chip cores: %d  @ %u MHz\n", ESP.getChipCores(), ESP.getCpuFreqMHz());
  Serial.printf("  Free heap : %u bytes\n\n", ESP.getFreeHeap());

  // ── IMU ──────────────────────────────────
  Serial.println("--- [1/3] MPU-6050 IMU (I2C) ---");
  imu_ok = initIMU();
  Serial.printf("    Result: %s\n\n", imu_ok ? "PASS ✓" : "FAIL ✗ (check SDA/SCL wiring)");

  // ── SIM800L ──────────────────────────────
  Serial.println("--- [2/3] SIM800L GSM (UART1) ---");
  sim800_ok = initSIM800();
  Serial.printf("    Result: %s\n\n", sim800_ok ? "PASS ✓" : "PARTIAL/FAIL (check power & SIM card)");

  // ── A6 NEO ───────────────────────────────
  Serial.println("--- [3/3] A6 NEO GSM (UART2) ---");
  a6_ok = initA6();
  Serial.printf("    Result: %s\n\n", a6_ok ? "PASS ✓" : "PARTIAL/FAIL (check power & SIM card)");

  // ── Summary ──────────────────────────────
  Serial.println("========== SUMMARY ===========");
  Serial.printf("  MPU-6050 IMU : %s\n", imu_ok     ? "✓ OK" : "✗ NOT DETECTED");
  Serial.printf("  SIM800L      : %s\n", sim800_ok  ? "✓ OK" : "✗ CHECK WIRING / SIM");
  Serial.printf("  A6 NEO       : %s\n", a6_ok      ? "✓ OK" : "✗ CHECK WIRING / SIM");
  Serial.println("==============================\n");
  Serial.println(">> Streaming IMU JSON (paste into dashboard)...");
  Serial.println(">> Format: {\"imu\":{\"ax\":0.0,\"ay\":0.0,...},\"sim800\":true,\"a6\":true}\n");
}

// ─── Loop ────────────────────────────────────────────────────────────────────
void loop() {
  static uint32_t last = 0;
  if (millis() - last < 100) return;   // 10 Hz
  last = millis();

  ImuData d{};
  if (imu_ok) d = readIMU();

  // JSON stream for the HTML dashboard
  Serial.printf(
    "{\"imu\":{\"ok\":%s,\"ax\":%.3f,\"ay\":%.3f,\"az\":%.3f,"
    "\"gx\":%.2f,\"gy\":%.2f,\"gz\":%.2f,\"temp\":%.1f},"
    "\"sim800\":%s,\"a6\":%s,\"ms\":%lu}\n",
    d.ok ? "true" : "false",
    d.ax, d.ay, d.az, d.gx, d.gy, d.gz, d.temp,
    sim800_ok ? "true" : "false",
    a6_ok     ? "true" : "false",
    millis()
  );
}
