#pragma once
// Copy to ignored config.local.h. Provisioning writes the real per-device key there.
#define WIFI_SSID "YOUR_2_4_GHZ_HOTSPOT"
#define WIFI_PASSWORD "YOUR_HOTSPOT_PASSWORD"
#define DEVICE_ID "IG-DEMO-0001"
#define DEVICE_SECRET "REPLACE_WITH_PROVISIONED_SECRET"
// This must be the laptop's Wi-Fi IPv4 address, never localhost from an ESP.
#define TELEMETRY_URL "http://192.168.1.2:3000/api/devices/telemetry"
#define ALLOW_LOCAL_HTTP true
#define ROOT_CA ""
#define MPU_SDA 8
#define MPU_SCL 9
#define GPS_RX 16
