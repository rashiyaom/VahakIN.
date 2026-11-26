#!/usr/bin/env python3
"""SIM800L Deep Diagnostic — VahakIN"""
import serial, time, sys

PORT = '/dev/cu.usbmodem101'

def try_baud(baud):
    try:
        ser = serial.Serial(PORT, baud, timeout=1.5)
        time.sleep(0.3)
        ser.reset_input_buffer()
        ser.write(b'AT\r\n')
        time.sleep(1.5)
        r = ser.read(256).decode('utf-8', errors='replace').strip()
        ser.close()
        return r
    except Exception as e:
        return str(e)

print("=" * 55)
print("  VahakIN  SIM800L Deep Diagnostic")
print("=" * 55)

# 1. Baud sweep
print("\n[1] Baud rate sweep (SIM800L auto-baud detection)")
bauds = [9600, 115200, 19200, 38400, 4800, 57600]
found_baud = None
for baud in bauds:
    r = try_baud(baud)
    status = "RESPONDED" if r and 'OK' in r else ("DATA" if r else "silent")
    print("  {:7d} baud -> {}  {}".format(baud, status, repr(r[:50])))
    if 'OK' in r:
        found_baud = baud
        break

if found_baud:
    print("\n  FOUND at {} baud!".format(found_baud))
else:
    print("\n  No response at any baud rate.")

# 2. Listen for SIM800L boot sequence (power-cycle the module to trigger)
print("\n[2] Listening 8 s for any SIM800L unsolicited output")
print("    (If you can, briefly unplug SIM800L power and re-connect now)")
ser = serial.Serial(PORT, 9600, timeout=0.5)
ser.reset_input_buffer()
deadline = time.time() + 8
collected = b''
while time.time() < deadline:
    chunk = ser.read(128)
    if chunk:
        collected += chunk
        print("  RECV:", repr(chunk))
    time.sleep(0.1)
if not collected:
    print("  Nothing received — SIM800L may be powered off or UART wires wrong")

# 3. Try burst AT at multiple bauds simultaneously via rapid switching
print("\n[3] Rapid-fire AT burst (all bauds)")
ser.close()
for baud in [9600, 115200, 19200, 38400]:
    ser2 = serial.Serial(PORT, baud, timeout=0.3)
    ser2.reset_input_buffer()
    for _ in range(3):
        ser2.write(b'AT\r\n')
        time.sleep(0.1)
    r = ser2.read(128).decode('utf-8', errors='replace').strip()
    if r:
        print("  GOT RESPONSE at {} baud: {}".format(baud, repr(r[:80])))
    ser2.close()

print("\n[4] Diagnosis")
print("-" * 55)
if not collected and not found_baud:
    print("""  RESULT: SIM800L is completely silent.

  Most likely causes (in order):
  A) Serial bridge sketch NOT flashed yet
     -> Flash serial_bridge.ino in Arduino IDE first
        Board: ESP32S3 Dev Module, USB CDC On Boot: Enabled
        Port:  /dev/cu.usbmodem101

  B) SIM800L powered off / wrong voltage
     -> SIM800L EVB V2.0 needs EXACTLY 5V from Buck A
     -> NOT powered from ESP 3.3V or USB
     -> Check the red PWR LED on SIM800L board
        * Blinking every 3s = searching network   GOOD
        * Blinking every 1s = connected           GOOD
        * Solid ON           = wrong voltage       BAD
        * LED OFF            = no power            BAD

  C) UART wires swapped / not connected
     -> SIM800L TX -> GPIO 17 (ESP RX1)   <- CROSSED
     -> SIM800L RX -> GPIO 18 (ESP TX1)
     -> Confirm with multimeter: GPIO17 ~1.8-3.3V at idle

  D) Baud rate mismatch
     -> After cold start SIM800L may need AT 3x to auto-sync
     -> Default is 9600; EVB board may differ
""")
else:
    print("  SIM800L is responding - run send_sms.py now")
