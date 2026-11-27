// Basic device only. Private Wi-Fi/signing credentials remain in config.local.h.
#define VAHAKIN_PLUS 0
#if __has_include("config.local.h")
#include "config.local.h"
#else
#include "config.example.h"
#endif
#include <atomic>
std::atomic<unsigned long> gpsBytes{0};
void basicGpsByte(char c) {
  ++gpsBytes;
  static char line[128]; static size_t used=0; static unsigned long last=0;
  if(c=='$') used=0;
  if(c=='\n') {
    line[used]=0;
    if(millis()-last>=10000 && strstr(line,"GGA,")) {
      Serial.printf("GPS NMEA: %s\n",line); last=millis();
    }
    used=0;
  } else if(used<sizeof(line)-1) line[used++]=c;
}
#define VAHAKIN_GPS_BYTE(c) basicGpsByte(c)
#define setup basicRuntimeSetup
#define loop basicRuntimeLoop
#include <VahakinDemo.h>
#undef setup
#undef loop
void setup() {
  Serial.begin(115200); delay(1500);
  WiFi.onEvent([](WiFiEvent_t event, WiFiEventInfo_t info) {
    if(event==ARDUINO_EVENT_WIFI_STA_DISCONNECTED)
      Serial.printf("WiFi disconnected: reason=%u\n",info.wifi_sta_disconnected.reason);
    if(event==ARDUINO_EVENT_WIFI_STA_GOT_IP)
      Serial.printf("WiFi connected: IP=%s gateway=%s\n",WiFi.localIP().toString().c_str(),WiFi.gatewayIP().toString().c_str());
  });
  Serial.printf("VahakIN BASIC | Device ID: %s | Activation code: VAHAKIN-2026\n",DEVICE_ID);
  Wire.begin(MPU_SDA,MPU_SCL,100000); Wire.setTimeOut(25);
  unsigned found=0;
  for(uint8_t address=1;address<127;address++) {
    Wire.beginTransmission(address);
    if(Wire.endTransmission()==0) { Serial.printf("I2C responding: 0x%02X\n",address); ++found; }
  }
  Serial.printf("I2C scan: %u devices, SDA=%d SCL=%d | GPS RX=%d 9600 baud\n",found,MPU_SDA,MPU_SCL,GPS_RX);
  Serial.printf("Idle bus levels: SDA=%d SCL=%d (both should be high)\n",digitalRead(MPU_SDA),digitalRead(MPU_SCL));
  if(!found) {
    Wire.end(); Wire.begin(MPU_SCL,MPU_SDA,100000); Wire.setTimeOut(25);
    unsigned swapped=0;
    for(uint8_t address=1;address<127;address++) {
      Wire.beginTransmission(address);
      if(Wire.endTransmission()==0) { Serial.printf("Swapped I2C responding: 0x%02X\n",address); ++swapped; }
    }
    Serial.printf("Swapped I2C scan: %u devices (SDA=%d SCL=%d)\n",swapped,MPU_SCL,MPU_SDA);
  }
  Wire.end(); basicRuntimeSetup();
}
void loop() {
  basicRuntimeLoop();
  static unsigned long last=0;
  if(millis()-last<10000) return;
  last=millis();
  Serial.printf("Basic=%s SSID=%s IP=%s gateway=%s RSSI=%d GPS bytes=%lu\n",DEVICE_ID,WiFi.SSID().c_str(),WiFi.localIP().toString().c_str(),WiFi.gatewayIP().toString().c_str(),WiFi.RSSI(),gpsBytes.load());
  Snapshot s; portENTER_CRITICAL(&sharedMux); s=shared; portEXIT_CRITICAL(&sharedMux);
  if(s.gpsAt && millis()-s.gpsMillis<10000)
    Serial.printf("GPS fix: %.6f, %.6f | satellites=%d HDOP=%.2f\n",s.lat,s.lng,s.satellites,s.hdop);
}
