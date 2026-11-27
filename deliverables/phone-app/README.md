# VahakIN Plus — Android Phone App (Capacitor)

Ready-to-install Android APK and Capacitor companion application for the VahakIN Non-Use Compliance and Monitoring platform.

## 📱 Downloadable APK Files

- **Root APK**: [`vahakin-phone-app.apk`](file:///Users/rashiyaom/Desktop/idleguard/vahakin-phone-app.apk) (3.6 MB)
- **Deliverables APK**: [`deliverables/phone-app/vahakin-phone-app.apk`](file:///Users/rashiyaom/Desktop/idleguard/deliverables/phone-app/vahakin-phone-app.apk)
- **Gradle Build Output**: [`deliverables/phone-app/android/app/build/outputs/apk/debug/app-debug.apk`](file:///Users/rashiyaom/Desktop/idleguard/deliverables/phone-app/android/app/build/outputs/apk/debug/app-debug.apk)

---

## 🚀 Quick Setup & Hotspot Connection

### 1. Transfer & Install on Android Phone
1. Transfer `vahakin-phone-app.apk` to your phone via USB, Google Drive, WhatsApp, or LocalSend/AirDrop.
2. Tap the APK file to install (allow "Install from unknown sources" if prompted).
3. Open **VahakIN**.

### 2. Connect via Hotspot / Wi-Fi
Ensure your phone and laptop are connected to the same network (either phone hotspot or home/office Wi-Fi).

1. Find your laptop's current IP address on the network:
   ```bash
   ipconfig getifaddr en0
   ```
   *(e.g., `10.232.124.31` or `192.168.43.x` on Android hotspot)*

2. Start the VahakIN server on your laptop listening on all interfaces (`0.0.0.0`):
   ```bash
   cd apps/web
   npm run dev -- -H 0.0.0.0 -p 3000
   ```

3. In the phone app:
   - The launcher defaults to your laptop's current address (`http://10.232.124.31:3000`).
   - Tap **Ping Test** to verify connectivity with your laptop server.
   - Tap **Connect to VahakIN**.
   - With "Auto-connect on launch" enabled, future launches will automatically open the server once verified.

---

## 📍 Phone Location (GPS) Streaming

The Android companion is configured with native location permissions:
- `ACCESS_FINE_LOCATION` and `ACCESS_COARSE_LOCATION` requested upfront on launch.
- Cleartext HTTP allowed for private RFC-1918 networks (`android:usesCleartextTraffic="true"`).
- Geolocation permission prompts automatically granted for local network origins.
- Ready to stream high-accuracy GPS coordinates into `PhoneLocationSharing.tsx` in the Owner Dashboard.
