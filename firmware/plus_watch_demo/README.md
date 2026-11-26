# Plus watch demonstration

Target: **Waveshare ESP32-S3-Touch-AMOLED-2.06**, onboard **QMI8658**, SDA **GPIO15**, SCL **GPIO14**, I²C address 0x6B (0x6A fallback). This matches the product description supplied. Do not use Basic's pins on this watch. No external GPS or SIM is required or initialized. The sketch is prepared and compiled, **not flashed or tested on the physical watch**.

## Physical label

```text
VAHAKIN PLUS · DEMO
Device ID:       IG-PLUS-0001
Activation code: VAHAKIN-PLUS-2026
Mounting place:  Car dashboard
```

This device and its BASIC counterpart `IG-DEMO-0001` / `VAHAKIN-2026` are registered in the connected Supabase inventory. Tier comes from inventory when the owner claims the ID/code. The application and RTO review show the tier automatically. Use a normal registered owner account, not the separate fictional demo workspace. The fixed activation code reserves one device; the independent random telemetry signing secret is private. Both devices use the supplied hotspot credentials in ignored `config.local.h` files.

## Demonstration flow

1. Join the laptop and watch to the configured **testing** hotspot (2.4 GHz). Follow the [Basic laptop setup](../hotspot_imu_demo/README.md) for the HTTP telemetry server on port 3000. From the repository root run `python3 tools/configure-hotspot-endpoint.py --device plus --port 3000` after joining the hotspot. Compile again whenever the endpoint changes.
2. Owner signs in, claims the Plus label, fills the application and uploads evidence. The assigned RTO sees the package, including previews, and can approve, request corrections, or reject with a reason.
3. After approval, securely fix the watch on the **car dashboard**, clear of airbags, controls and sightlines. In the application, press **Yes, I have mounted the device in my car**. Hold still for five seconds at startup for calibration. A reviewer records installation separately after an authenticated device connection.
4. Open the owner website **on the phone** using the trusted HTTPS setup below. In Overview, Vehicles or Location monitoring, tick the consent confirming the phone is beside the mounted watch, then tap **Share phone location** and allow browser location permission. Keep this page visible, unlocked and open. Stop sharing before separating the phone from the car/watch.
5. RTO → Location monitoring → Parking geofence: choose the vehicle, enter the actual parking centre and radius, and save. The circle is drawn on the map. Both roles see phone-provided location separately from IMU motion. Only the owner can start sharing; only the authorized RTO administrator can configure the fence.

## Phone HTTPS on this laptop

Browser geolocation needs a [secure context and permission](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition). Plain `http://LAPTOP-IP:3000` is insufficient on a phone. The firmware can continue sending signed telemetry to that private HTTP endpoint while the phone uses HTTPS against the same database.

From the repository root:

```sh
python3 tools/prepare-phone-https.py
```

This generates private files in ignored `apps/web/.local-https` for the laptop's current hotspot IP. It does **not** change system trust. Copy **only `rootCA.crt`** to the phone and install/trust this demo CA. Keep all `.key` files on the laptop. On iPhone, after installing the profile, enable its trust under Settings → General → About → Certificate Trust Settings ([Apple instructions](https://support.apple.com/en-us/102390)). On Android, use the phone's certificate settings to install it as a **CA certificate**; menu labels vary by phone. Remove this demo CA when finished.

From `apps/web`, in a second terminal:

```sh
VAHAKIN_BUILD_DIR=.next-phone node node_modules/next/dist/bin/next dev --hostname 0.0.0.0 --port 3443 --experimental-https --experimental-https-key .local-https/server.key --experimental-https-cert .local-https/server.crt --experimental-https-ca .local-https/rootCA.crt
```

Open the printed `https://LAPTOP-IP:3443` address on the phone, sign in with an already verified owner account, and check that there is no certificate warning. Merely bypassing a warning is not a substitute for trusted HTTPS. Allow the laptop's local firewall connection if requested. Rerun certificate preparation and restart HTTPS if the hotspot IP changes; the existing CA is retained. The two Next development servers use separate build directories. Do not publish the private key or expose these development servers to the public internet.

## Signals and limits

- The onboard accelerometer uses ±4 g and gyro ±256°/s with low-pass filtering; host sampling is 50 Hz. Basic and Plus share the same calibrated motion classifier and signed transport implementation in `firmware/libraries/VahakinDemo`.
- Five seconds of stillness calibrates gravity/gyro bias. A rolling two-second window needs ≥1.5 seconds above 0.12 g dynamic acceleration **or** 12°/s rotation; short bumps and tiny vibration do not trigger it. Five quiet seconds re-arm the detector. Physical calibration/threshold checks remain necessary on your watch.
- IMU motion can mean vehicle movement **or device handling**. It cannot establish position, metres travelled or perfectly smooth constant-velocity travel. The website says “Sustained device movement detected,” rather than inventing a measured displacement.
- Plus sends `gps:null`; the server rejects GPS supplied by Plus firmware and never lets watch telemetry erase phone location. Phone updates do not refresh the watch heartbeat or alter its motion/approval/ownership.
- Phone samples are requested every five seconds after the previous request completes. Samples must be ≤15 seconds old and have reported accuracy ≤30 m. Browser location may combine satellite, Wi-Fi and cellular sources; it is not a GPS sensor in the watch.
- Geofencing needs two accepted positions 3–30 seconds apart beyond the radius plus max(25 m, reported accuracy). Boundary/poor/stale fixes do not establish an exit. An alert requires a fresh watch reading and explicitly describes **phone-provided demonstration evidence**, not proof that the watch or vehicle travelled. This is a demo, not tamper-proof tracking.
- Stop, page hide, navigation and unmount end sharing. Server session lease is 60 seconds; a last position is marked historical after 15 seconds if the browser/network disappears. Historical coordinates remain visible and labelled. Each new sharing session replaces the prior one.
- The sketch requires NTP clock sync through the hotspot before signing telemetry. There is no GPS clock fallback on Plus. A bounded NVS queue retains eight unacknowledged movement events; losses are counted in serial diagnostics. Both sketches retry without blocking sensor sampling.
- This focused sketch replaces the manufacturer's factory application when eventually flashed. It does not implement the AMOLED/touch/microphone interface or promise the factory watch screen will remain usable. Monitoring is on the website and USB serial. No flash has been performed.

## Compile / provision

From repository root (ESP32 Arduino core 2.0.17 was used for validation):

```sh
arduino-cli compile --fqbn esp32:esp32:esp32s3 --libraries firmware/libraries firmware/plus_watch_demo
```

Recheck provisioning from `apps/web` with `node --env-file=.env.local scripts/provision-hotspot-demo.mjs plus`. It refuses mismatched credentials and does not reassign an existing device. Wait for explicit authorization before uploading.

Hardware references: [manufacturer board documentation](https://www.waveshare.com/wiki/ESP32-S3-Touch-AMOLED-2.06), [manufacturer examples and QMI8658 driver](https://github.com/waveshareteam/ESP32-S3-Touch-AMOLED-2.06/tree/3de8684cc3b27a8b6aa920157ecf399287528181/examples/arduino). Pins and scale/ODR registers were checked against those examples.
