# Hotspot MPU / GPS hardware demonstration

This sketch targets ESP32-S3 with GY-521 / MPU-6050 and NEO-6M. It has **not been flashed**. Hardware thresholds need a stationary/bump/movement check on the actual mounted assembly before the presentation.

## Device label

```text
VAHAKIN · HARDWARE DEMO
Device ID:       IG-DEMO-0001
Activation code: VAHAKIN-2026
Mounting place:  Car dashboard
```

The label code is intentionally fixed for this demonstration. It claims a single provisioned device; it is not a login password or telemetry signing key. Use a normal owner account backed by Supabase. The fictional `demo@gmail.com` workspace has a separate local inventory and does not receive physical hardware telemetry. A second owner cannot claim a reserved or assigned unit. Rejection releases an unassigned reservation.

The random signing secret and hotspot password are in ignored `config.local.h`; the provisioning record is in ignored `apps/web/.provisioned/IG-DEMO-0001.json`. Do not put these on the label or commit them. The database stores a hash of the activation code. `provision-hotspot-demo.mjs` is idempotent and refuses to overwrite different credentials or change assignments.

## Wiring used

| Device connection | ESP32-S3 |
| --- | --- |
| GY-521 SDA / SCL | GPIO8 / GPIO9 |
| GY-521 supply | Verified 3.3 V / shared GND |
| NEO-6M TX | GPIO16 RX, 9600 baud |
| NEO-6M RX | Unconnected |
| NEO-6M supply | Verified 3.3 V / shared GND |

The SIM800L, MPU INT, reed switches, SPDT inputs and voltage divider are not sampled in this focused demo. No battery or tamper values are fabricated. Follow the assembly's power wiring: avoid simultaneous USB power and the external buck supply unless power isolation has been verified.

## Laptop / hotspot setup

1. Enable the configured **testing** phone hotspot in 2.4 GHz mode. Join this laptop to the same hotspot. The password is already saved privately.
2. From `apps/web`, start the site using `node node_modules/next/dist/bin/next dev --hostname 0.0.0.0 --port 3000`. Keep the laptop awake. Supabase access needs internet through the hotspot.
3. Once the laptop is on that hotspot, run `python3 tools/configure-hotspot-endpoint.py --port 3000` from the repository root. The IP can change when switching networks; repeat this before compiling/flashing. The current private config points at the laptop IP observed during implementation, not a promised future hotspot IP.
4. Permit incoming local connections to Node if macOS Firewall requests it. The phone must allow connected clients to reach each other. `localhost` on the ESP would refer to the ESP itself and must never be used as the server address.
5. Sign in as an owner, claim the label above, complete the package, and submit it. In the RTO account, preview the documents and approve or request corrections/reject with a reason.
6. After approval, securely mount on the **car dashboard**, clear of controls, airbags and the driver's sightline. Click **Yes, I have mounted the device in my car**. A reviewer can then record installation after a fresh signed connection. IMU demonstration alerts may be inspected after the owner's mounting confirmation; regulatory monitoring is not automatically activated.
7. In the RTO **Location monitoring** page, select the vehicle and save its parking geofence centre/radius. The map draws that circle. Use the parked car's actual coordinates; the default map view over Rajkot is not a device position.

Local HTTP is explicitly limited to private IPv4 addresses. HMAC authenticates exact request bytes, but local HTTP does not encrypt telemetry; use this on the private demonstration hotspot. For deployment, set an HTTPS endpoint and its root CA; the sketch never disables TLS certificate verification. Hotspot connectivity does not expose the phone's GPS to the ESP.

## Motion / GPS behaviour

- Independent 50 Hz sensor task; a slow website upload cannot pause sampling. MPU low-pass filter is 21 Hz, acceleration ±2 g and gyro ±250°/s. Missing I²C data becomes **Sensor fault**, retries initialization and requires calibration again.
- Five seconds of stillness are required for gravity/gyro calibration. Movement during that period restarts calibration. A polling gap over 100 ms also resets it.
- A rolling two-second window must contain at least 1.5 seconds above **0.12 g dynamic acceleration OR 12°/s rotation**. Brief bumps and small X/Y vibration fail that duration gate. Five seconds of quiet re-arms detection. These are demonstration starting thresholds, not validated automotive thresholds.
- Rotation and handling are intentionally reported as **device motion**. An MPU cannot prove that the car translated, estimate trustworthy distance, or continuously detect perfectly smooth constant-velocity travel. GPS is the independent location signal.
- GPS parses checksum-validated RMC/GGA in either sentence order, matches UTC seconds and requires a valid fix. NTP normally sets the clock; a valid RMC date can establish it when NTP is unavailable. No signed request is sent without a valid clock.
- Server geofencing requires at least five satellites, HDOP ≤2.5, fresh fixes, two observations 3–30 seconds apart, and a **25 m boundary buffer**. HDOP is not labelled metre accuracy. Fixes in the buffer produce **Boundary**, bad/stale fixes produce **Unknown**, and a changed fence discards prior confirmation. A GPS fix is normally unavailable indoors; put the antenna near a window or outside for acquisition.
- Fresh telemetry uploads every five seconds; dashboard refreshes every five seconds. IMU status becomes stale after 30 seconds and GPS after 15 seconds. Installation, connection, motion, location and regulatory declaration remain separate states.
- Exact JSON bodies are HMAC-SHA256 signed with a per-device secret; server timestamp tolerance is five minutes. Retries use the same nonce/body and are idempotent. Delayed samples cannot overwrite a newer observation. SQL commits serialize against onboarding/geofence edits and deduplicate alert identities.
- The first eight unacknowledged movement events are retained in NVS across network loss/reboot. After the queue fills, additional events are counted as lost in serial diagnostics. Motion before time sync is also counted as lost rather than assigned a false timestamp. This bounded prototype is not an archival recorder. After a long outage, current measurements are refreshed while original queued movement times remain attached to alerts.
- The API stores accepted hardware packets in private `ig_hardware_events`. This pilot currently has no automatic retention cleanup for those evidence rows; plan retention before prolonged deployment.

## Build and tests

Arduino sketch: `hotspot_imu_demo.ino`. Include the repository’s shared `firmware/libraries` directory. No third-party Arduino libraries are required; it uses ESP32 Arduino core WiFi/HTTP/Wire/Preferences/mbedTLS.

```sh
arduino-cli compile --fqbn esp32:esp32:esp32s3 --libraries firmware/libraries firmware/hotspot_imu_demo
c++ -std=c++17 -Wall -Wextra -pedantic firmware/tests/motion_detector_test.cpp -o /tmp/vahakin-motion-test
/tmp/vahakin-motion-test
```

The implementation session uses an isolated core installation under `/tmp/vahakin-arduino`; include `--config-file /tmp/vahakin-arduino/arduino-cli.yaml` with its compile command. Compilation is separate from uploading. Wait for the owner's explicit flash request and check board/power/port before uploading.

Web checks from `apps/web`: `npm run typecheck`, `npm test -- tests/unit`, and `npm run build`. Browser coverage is in `tests/e2e/enrollment.spec.ts`, `hardware-flow.spec.ts`, and opt-in `supabase-live.spec.ts`. Live integration creates isolated fixture accounts and a separate `IG-TEST-*` unit and deletes them; it does not submit fabricated readings under the labelled device.

Register/recheck the fixed device from `apps/web`:

```sh
node --env-file=.env.local scripts/provision-hotspot-demo.mjs
```

Technical references: [TDK MPU-6050 register map](https://invensense.tdk.com/wp-content/uploads/2015/02/MPU-6000-Register-Map.pdf) and [Espressif secure client](https://github.com/espressif/arduino-esp32/blob/master/libraries/NetworkClientSecure/README.md).
