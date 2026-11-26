#!/usr/bin/env python3
"""
VahakIN — SIM800L Direct AT Command Tester
===========================================
Reads JSON output from an already-flashed ESP32-S3 sketch,
OR runs in passthrough mode if the sketch is a serial bridge.

Usage (after flashing sim800l_internet_test.ino OR the hw_test.ino):
    python3 sim_check.py

Requirements: python3 -m pip install pyserial
"""

import serial, json, time, sys, threading

PORT  = "/dev/cu.usbmodem101"
BAUD  = 115200

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def colour(text, c): return f"{c}{text}{RESET}"

def print_banner():
    print(colour("╔══════════════════════════════════════╗", CYAN))
    print(colour("║   VahakIN  SIM800L Serial Monitor    ║", CYAN))
    print(colour("╚══════════════════════════════════════╝", CYAN))
    print(f"  Port : {PORT}  |  Baud : {BAUD}")
    print(f"  Time : {time.strftime('%Y-%m-%d %H:%M:%S')}\n")

def parse_json(line: str):
    """Pretty-print the JSON heartbeat from the sketch."""
    try:
        d = json.loads(line)
        if "sim800" in d:
            s = d["sim800"]
            status = colour("✓", GREEN) if s.get("synced") else colour("✗", RED)
            sim    = colour("✓ READY", GREEN) if s.get("sim") else colour("✗ NOT DETECTED", RED)
            gprs   = colour("✓ UP", GREEN) if s.get("gprs") else colour("✗ DOWN", RED)
            inet   = colour("✓ INTERNET OK", GREEN) if s.get("internet") else colour("✗ No internet", RED)
            dbm    = s.get("rssi_dbm", -999)
            bars   = "▂___" if dbm < -110 else "▂▄__" if dbm < -100 else "▂▄▆_" if dbm < -90 else "▂▄▆█"
            print(f"\n{colour('── SIM800L Status ──', BOLD)}")
            print(f"  Module   : {status}")
            print(f"  SIM card : {sim}")
            print(f"  ICCID    : {s.get('iccid','—')}")
            print(f"  Operator : {colour(s.get('operator','—'), YELLOW)}")
            print(f"  Signal   : {bars} {dbm} dBm (CSQ={s.get('csq','?')})")
            print(f"  GPRS     : {gprs}")
            print(f"  APN      : {s.get('apn','—')}")
            print(f"  IP Addr  : {colour(s.get('ip','—'), CYAN)}")
            print(f"  Internet : {inet}")
            return True
        if "imu" in d:
            imu = d["imu"]
            print(f"  IMU: ax={imu.get('ax',0):+.3f} ay={imu.get('ay',0):+.3f} az={imu.get('az',0):+.3f}  "
                  f"gx={imu.get('gx',0):+.1f} gy={imu.get('gy',0):+.1f} gz={imu.get('gz',0):+.1f}  "
                  f"T={imu.get('temp',0):.1f}°C", end="\r")
    except (json.JSONDecodeError, KeyError):
        pass
    return False

def main():
    print_banner()
    try:
        ser = serial.Serial(PORT, BAUD, timeout=0.5)
    except serial.SerialException as e:
        print(colour(f"✗ Cannot open {PORT}: {e}", RED))
        print("  → Make sure no other app (Arduino IDE Serial Monitor) is using the port")
        sys.exit(1)

    print(colour(f"✓ Connected to {PORT}", GREEN))
    print(f"  Reading output — press Ctrl+C to quit\n")
    print(colour("  Tip: Type AT commands and press Enter to send to SIM800L\n", YELLOW))

    # Input thread for passthrough AT commands
    stop = threading.Event()
    def input_thread():
        while not stop.is_set():
            try:
                cmd = input()
                if cmd.strip():
                    ser.write((cmd.strip() + "\r\n").encode())
                    print(colour(f"[TX→] {cmd.strip()}", CYAN))
            except (EOFError, KeyboardInterrupt):
                break
    t = threading.Thread(target=input_thread, daemon=True)
    t.start()

    buf = ""
    try:
        while True:
            raw = ser.read(256)
            if not raw:
                continue
            buf += raw.decode("utf-8", errors="replace")
            while "\n" in buf:
                line, buf = buf.split("\n", 1)
                line = line.strip()
                if not line:
                    continue
                if line.startswith("{"):
                    if not parse_json(line):
                        print(f"[RAW] {line}")
                else:
                    # Colour-code key status lines
                    if "✓" in line or "PASS" in line or "READY" in line or "OK" in line.upper():
                        print(colour(line, GREEN))
                    elif "✗" in line or "FAIL" in line or "ERROR" in line or "NOT" in line:
                        print(colour(line, RED))
                    elif "SUMMARY" in line or "===" in line or "╔" in line or "╚" in line:
                        print(colour(line, CYAN))
                    else:
                        print(line)
    except KeyboardInterrupt:
        print(colour("\n\nDisconnected.", YELLOW))
    finally:
        stop.set()
        ser.close()

if __name__ == "__main__":
    main()
