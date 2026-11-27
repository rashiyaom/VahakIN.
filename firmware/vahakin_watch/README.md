# VahakIN Plus watch UI

Target: Waveshare **ESP32-S3-Touch-AMOLED-2.06**. USB inspection on 27 November 2026 confirmed ESP32-S3 revision 0.2, 8 MB PSRAM and 32 MB flash on `/dev/cu.usbmodem101`.

The firmware is a native Arduino/FreeRTOS application with LVGL 9.3, not Apple watchOS. It replaces the factory application when flashed. The existing headless Plus sketch remains available separately.

## Screens and preview

Open [`../../deliverables/watch-ui/index.html`](../../deliverables/watch-ui/index.html) locally. Seven 410 × 502 screens: watch face, launcher, location, live IMU chart, vehicle, activity, power/brightness. PNGs are produced by compiling the same `WatchUI.h` against LVGL on the host. The preview's interactive map and sleep controls run in the browser; they do not emulate ESP32 hardware.

True black, VahakIN lime, 24–48 px primary text, rounded cards, 46–65 px controls. The map pans in both axes and has a recenter control. It contains 379 road/building paths derived from OpenStreetMap around Mahatma Mandir, Gandhinagar, including Dandi Kutir, Station Road, KH Road and adjoining sectors. It works without internet or map API keys. Coverage is approximately one kilometre across; no route guidance, pinch zoom or live tile download is implemented.

**Gate 7 / Auditorium is an approximate presentation marker at the convention building, not surveyed gate or indoor positioning.** The venue is confirmed by the user; its presentation coordinate is 23.23127, 72.63359. Fixture vehicle/activity records and the presentation location remain local, never uploaded as hardware evidence. As requested, no “dummy” label appears on the watch. The website retains its existing demonstration labels. IMU and battery screens do not substitute fake measurements when sensors are unavailable.

## Motion and battery

- Cold boot stays dark until significant IMU movement. An IMU interrupt wake restores the previous page and brightness.
- Awake threshold: 0.18 g change on any acceleration axis or 25°/s on any gyro axis, present for at least 60 ms. Small noise and isolated impulses do not refresh the timer.
- Five seconds after the last qualifying movement, AMOLED brightness is set to zero and display sleep commands are sent. Touch does **not** extend the timer.
- QMI8658 enters accelerometer-only low-power 128 Hz wake-on-motion mode: threshold 180 mg, INT1 initially low, eight-sample startup blanking. INT1 connects to RTC-capable GPIO21; EXT0 high wakes the ESP32 from deep sleep. This is the sensor's hardware acceleration threshold, not the awake software persistence filter. Pure rotation without sufficient acceleration may not wake a sleeping device.
- Touch hibernates, amplifier is disabled, Wi-Fi stops and the processor deep-sleeps. The IMU power rail stays on. This reduces consumption but is not a measured battery-life guarantee.
- In-flight HTTP work finishes before deep sleep; display shuts off first. If WoM setup fails, the watch remains dark and retries sensor initialization instead of sleeping without a working wake source.
- Two stationary seconds calibrate the website motion classifier (the old sketches retain five seconds). Calibration is retained in RTC memory across deep sleep; evidence windows are cleared so sleep time is never counted as motion. Sustained movement alerts still use the existing 1.5-of-2-second rule.
- Deep sleep disconnects USB and Wi-Fi. No heartbeat or GPS refresh occurs during sleep, so the website can correctly mark the watch stale. Initial Wi-Fi/NTP may need more than one wake cycle; keep moving occasionally during first connection. IMU sampling and LVGL share the main loop; a rendering stall resets the evidence window. Network work runs on the other core.

## Website / hotspot

`build.sh` copies the existing ignored Plus configuration, preserving `IG-PLUS-0001` and its signing secret. The supplied `testing` credentials are saved only in ignored `config.local.h`. Never share compiled binaries: they contain Wi-Fi and device credentials.

Join the laptop and watch to the same **2.4 GHz** hotspot, then run:

```sh
python3 tools/configure-hotspot-endpoint.py --device plus --port 3000
# In apps/web, use the existing environment and server:
node node_modules/next/dist/bin/next dev --hostname 0.0.0.0 --port 3000
```

Rebuild after changing the laptop address. Last configured endpoint: `http://10.164.19.153:3000/api/devices/telemetry`; it can change. The signed upload path, eight-event NVS queue, timestamp checks and Plus capability validation are reused. Firmware sends `gps:null` exclusively.

The authenticated telemetry response now includes a minimal `watch` view for that device's assigned vehicle. Fresh owner-shared phone location updates the watch's coordinates and map dot; stopped/expired/poor/stale phone samples are withheld. Live registration/declaration replace presentation defaults when returned. The watch cannot read a phone's GPS merely by joining its hotspot. Use **Share phone location** in the existing owner website, with its consent, approval, mounting and HTTPS requirements; see [Plus setup](../plus_watch_demo/README.md). The offline map only covers the exhibition area. Live coordinates beyond that area can be displayed numerically but have no surrounding map coverage.

## Reproducible build

Official Waveshare repository pinned to `3de8684cc3b27a8b6aa920157ecf399287528181`; bundled Arduino_GFX 1.6.0, DriveBus 1.0.1, SensorLib 0.3.1, XPowersLib 0.3.0 and LVGL 9.3.0. Arduino-ESP32 3.3.11. The isolated compiler and downloaded vendor libraries currently live under `/tmp` and may be removed by the OS.

```sh
# Set these if dependencies are installed elsewhere:
export WATCH_ARDUINO_CONFIG=/tmp/vahakin-watch-toolchain/arduino-cli.yaml
export WAVESHARE_LIBRARIES=/tmp/waveshare-watch/examples/arduino/libraries
firmware/vahakin_watch/build.sh
```

Build options: ESP32-S3, 32 MB flash, OPI PSRAM, USB CDC on boot, 3 MB app partition. Build output is ignored at `firmware/vahakin_watch/build/`. The session's temporary package index installed only S3 dependencies to avoid downloading unrelated chip compilers; upstream archive checksums were retained. A normal full `arduino-cli core install esp32:esp32@3.3.11` also works.

Host UI rendering:

```sh
cmake -S firmware/vahakin_watch/preview -B /tmp/vahakin-watch-preview -DLVGL_DIR="$WAVESHARE_LIBRARIES/lvgl"
cmake --build /tmp/vahakin-watch-preview -j 8
/tmp/vahakin-watch-preview/render deliverables/watch-ui
node tools/check-watch-preview.mjs
```

`tools/build-watch-map.py INPUT.osm` regenerates `VenueMap.h` and the preview SVG. Source extract: `https://api.openstreetmap.org/api/0.6/map?bbox=72.629,23.228,72.640,23.237`. Map data © OpenStreetMap contributors, [ODbL 1.0](https://www.openstreetmap.org/copyright); attribution is shown on the map. Derived geometry remains in the repository, without contributor account metadata.

## Flashing and recovery

No upload is part of the build script. Obtain explicit authorization before replacing the factory firmware, consistent with the existing Plus README. First back up the entire 32 MB flash into a private ignored location. Enter download mode by holding BOOT while reconnecting USB, then release BOOT. Inspect the port again because USB numbering can change.

```sh
mkdir -p firmware/vahakin_watch/.private
esptool --chip esp32s3 --port /dev/cu.usbmodem101 read-flash 0 0x2000000 firmware/vahakin_watch/.private/factory-backup.bin
arduino-cli --config-file /tmp/vahakin-watch-toolchain/arduino-cli.yaml upload \
 --fqbn 'esp32:esp32:esp32s3:FlashSize=32M,PSRAM=opi,PartitionScheme=huge_app,CDCOnBoot=cdc' \
 --port /dev/cu.usbmodem101 --input-dir firmware/vahakin_watch/build firmware/vahakin_watch
```

If recovery is needed, enter download mode again and write the private full backup at address 0. Vendor factory firmware is also available from the manufacturer repository. Do not use an unrelated model's image.

Physical acceptance after flashing: move to wake; remain still and confirm darkness after five seconds; move again to confirm GPIO21 wake; repeat on USB and battery; drag map both directions; compare live axes to movement; confirm website acknowledgments and fresh phone coordinates. Actual deep-sleep current and repeated physical wake reliability remain unmeasured until this test.

## Verification — 27 November 2026

Final ESP32-S3 compilation passed: 1,664,259 bytes of app storage (52% of the 3 MB partition), 51,504 bytes of static RAM. TypeScript check and 24 targeted website tests passed. Host motion tests cover noise, short impulses, sustained movement, five-second expiry, time rollover, sample gaps, two-second calibration and calibration retention. Seven native LVGL screens rendered successfully. Browser preview passed pan/recenter, sleep/wake and mobile overflow checks. Firmware has **not been flashed**; on-device behavior remains unverified.

## Sources

- [Waveshare board, pinout and peripherals](https://docs.waveshare.com/ESP32-S3-Touch-AMOLED-2.06)
- [Official examples, drivers and factory firmware](https://github.com/waveshareteam/ESP32-S3-Touch-AMOLED-2.06)
- [QMI8658C datasheet, wake-on-motion section 9](https://files.waveshare.com/wiki/common/QMI8658C.pdf)
- [Espressif ESP32-S3 sleep modes](https://docs.espressif.com/projects/esp-idf/en/v5.5/esp32s3/api-reference/system/sleep_modes.html)
- [Mahatma Mandir operator's venue factsheet](https://www.theleela.com/prod/content/assets/2022-10/mahatma-mandir-convention-exhibition-centre-factsheet.pdf)

## Walking POC (2026-11-27)

`HandlingAlarm.h` calibrates after five quiet seconds, persists the mounting gravity vector in NVS, and latches suspected handling from sustained tilt/rotation/acceleration. The ES8311 speaker plays a two-tone alarm; it clears only after five continuous quiet seconds within 12 degrees of the calibrated orientation. This does not prove physical replacement: a contact sensor is needed for that. The baseline can be cleared deliberately by deleting the `mount-vector` NVS key during maintenance; do not erase provisioning to recalibrate.

`WALK_DEMO_MODE=1` keeps IMU and networking awake even when the display goes dark. This is necessary for the live demonstration and consumes more battery than parked deep sleep. Set it to 0 to restore the original WoM sleep path after testing. The watch reports optional `imu.handling` in signed telemetry and never sends fabricated GPS.

The local web worker is started from `apps/web` with `node --env-file=.env.local scripts/walk-bridge.mjs`. Its WhatsApp credentials, configured numbers, QR status, outbox and POC state live in ignored `.provisioned/walk/`. One worker owns state and retries queued messages; a successful send call is not a read receipt. Supabase credentials stay on the laptop. Stop the worker and temporary tunnel after the session. Keep the laptop awake.

Rashiyaom opens `/gov/tracking` to pair the configured WhatsApp sender and set the 50 m reference from a fresh owner phone fix. Devanshi opens `/owner/tracking` via trusted HTTPS and keeps that page visible beside the watch. Existing application approval and placement confirmation are prerequisites. The reference is never guessed from the laptop IP. Boundary uncertainty uses at least 8 m and the phone's reported accuracy; use an outdoor test area. Each confirmed exit/return has a 3-minute allowance. Unknown GPS/IMU pauses the timer. The ₹12/km illustration applies only to accepted travel after the allowance; it is not a statutory fine.

The `/track#TOKEN` link is limited to the active 4-hour session, reveals only that vehicle's POC position/status, and is revoked by stopping the walk. Phone sharing pauses when its page is hidden, including opening WhatsApp on that phone. Use the second phone for viewing alerts during the walk.

Display inactivity is now 30 seconds (`MotionWake::idleMs`). Walking-demo mode keeps networking and IMU sampling active while the screen is off. The alarm-clear quiet period remains five seconds.
