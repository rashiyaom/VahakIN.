#!/usr/bin/env python3
"""
VahakIN — SIM800L SMS Sender
=============================
Sends: "hi i am om this side"  →  +919328087140
Port : /dev/cu.usbmodem101  |  Baud: 115200

Usage:
    python3 send_sms.py
    python3 send_sms.py --number 9328087140 --message "custom text"

Requirements: pip3 install pyserial
Flash serial_bridge.ino to ESP32-S3 first, then run this.
"""

import serial, time, sys, argparse, textwrap

PORT    = "/dev/cu.usbmodem101"
BAUD    = 115200

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def c(text, col): return f"{col}{text}{RESET}"

def banner():
    print(c("\n╔══════════════════════════════════════╗", CYAN))
    print(c("║   VahakIN  SIM800L  SMS  Sender      ║", CYAN))
    print(c("╚══════════════════════════════════════╝\n", CYAN))

def cmd(ser: serial.Serial, at: str, expect: str = "OK",
        timeout: float = 6.0, verbose: bool = True) -> tuple[bool, str]:
    """Send AT command, wait for expected response. Returns (success, raw_response)."""
    ser.reset_input_buffer()
    full_cmd = at.encode() + b"\r\n"
    if verbose:
        print(c(f"  → {at}", YELLOW), end=" ", flush=True)
    ser.write(full_cmd)

    deadline = time.time() + timeout
    buf = ""
    while time.time() < deadline:
        chunk = ser.read(256).decode("utf-8", errors="replace")
        buf += chunk
        if expect in buf or "ERROR" in buf or "+CME ERROR" in buf or "+CMS ERROR" in buf:
            break
        time.sleep(0.05)

    ok = expect in buf
    if verbose:
        result_str = c("✓ OK", GREEN) if ok else c(f"✗ FAIL ({buf.strip()[:60]})", RED)
        print(result_str)
    return ok, buf

def send_sms(ser: serial.Serial, number: str, message: str) -> bool:
    """Execute the full SMS send AT sequence."""
    # Ensure E164 format
    num_e164 = number if number.startswith("+") else f"+91{number.lstrip('0')}"

    print(c(f"\n  Number  : {num_e164}", BOLD))
    print(c(f"  Message : \"{message}\"\n", BOLD))

    steps = [
        ("AT",           "OK",    3,  "Ping module"),
        ("ATE0",         "OK",    3,  "Echo off"),
        ("AT+CMEE=2",    "OK",    3,  "Verbose errors"),
        ("AT+CPIN?",     "READY", 8,  "SIM card check"),
        ("AT+CREG?",     "+CREG", 5,  "Network registration"),
        ("AT+CSQ",       "+CSQ",  3,  "Signal quality"),
        ("AT+CMGF=1",    "OK",    3,  "SMS text mode"),
        ('AT+CSCS="GSM"',"OK",    3,  "GSM character set"),
    ]

    for at, exp, tmo, label in steps:
        ok, resp = cmd(ser, at, expect=exp, timeout=tmo)
        if not ok:
            if "CPIN" in at:
                print(c("\n  ✗ SIM not ready — check insertion and 5 V supply", RED))
                return False
            if "CREG" in at:
                print(c("\n  ⚠ Not registered — waiting 15 s more...", YELLOW))
                time.sleep(15)
                ok2, _ = cmd(ser, "AT+CREG?", "+CREG", 5)
                if not ok2:
                    print(c("  ✗ Still not registered. Check signal / SIM.", RED))
                    return False

    # --- CMGS sequence (needs special handling — prompt then Ctrl+Z) ---
    print(c(f"  → AT+CMGS=\"{num_e164}\"", YELLOW), end=" ", flush=True)
    ser.reset_input_buffer()
    ser.write(f'AT+CMGS="{num_e164}"\r\n'.encode())

    # Wait for '>' prompt
    deadline = time.time() + 8
    buf = ""
    while time.time() < deadline:
        buf += ser.read(64).decode("utf-8", errors="replace")
        if ">" in buf:
            break
        time.sleep(0.05)

    if ">" not in buf:
        print(c(f"✗ No prompt ({buf.strip()[:40]})", RED))
        return False
    print(c("got prompt >", GREEN))

    # Send message then Ctrl+Z (0x1A)
    print(c(f"  → [message body]", YELLOW), end=" ", flush=True)
    payload = message.encode("ascii", errors="replace") + b"\x1a"
    ser.write(payload)

    # Wait for +CMGS: <id> and OK
    deadline = time.time() + 30
    buf = ""
    while time.time() < deadline:
        buf += ser.read(256).decode("utf-8", errors="replace")
        if "+CMGS:" in buf and "OK" in buf:
            break
        if "ERROR" in buf:
            break
        time.sleep(0.1)

    if "+CMGS:" in buf:
        ref = ""
        idx = buf.find("+CMGS:")
        if idx >= 0:
            ref = buf[idx+6:idx+12].strip().split("\r")[0]
        print(c(f"✓ Sent! Message ref: {ref}", GREEN))
        return True
    else:
        print(c(f"✗ FAILED — {buf.strip()[:80]}", RED))
        return False

def main():
    parser = argparse.ArgumentParser(description="VahakIN SIM800L SMS Sender")
    parser.add_argument("--number",  default="9328087140", help="Destination number")
    parser.add_argument("--message", default="hi i am om this side", help="SMS text")
    parser.add_argument("--port",    default=PORT)
    parser.add_argument("--baud",    type=int, default=BAUD)
    args = parser.parse_args()

    banner()
    print(f"  Port : {args.port}  |  Baud : {args.baud}")
    print(f"  Time : {time.strftime('%Y-%m-%d %H:%M:%S')}\n")

    # ── Open serial ──────────────────────────────────────────────────────────
    try:
        ser = serial.Serial(args.port, args.baud, timeout=1)
    except serial.SerialException as e:
        print(c(f"✗ Cannot open {args.port}: {e}", RED))
        print("  → Close Arduino IDE Serial Monitor if open")
        sys.exit(1)

    time.sleep(2)  # Let ESP32 boot
    ser.reset_input_buffer()

    # Read any boot banner from ESP32
    boot = ser.read(256).decode("utf-8", errors="replace")
    if "BRIDGE_READY" in boot:
        print(c("✓ Serial bridge detected on ESP32-S3", GREEN))
    elif boot.strip():
        print(c(f"  Boot output: {boot.strip()[:80]}", YELLOW))
    else:
        print(c("  (no boot banner — proceeding)", YELLOW))

    # ── SIM signal check ──────────────────────────────────────────────────────
    print(c("\n── Pre-send checks ─────────────────────────────────────────", CYAN))
    ok, csq_resp = cmd(ser, "AT+CSQ", "+CSQ", 3)
    if ok:
        try:
            csq_val = int(csq_resp.split("+CSQ:")[1].split(",")[0].strip())
            dbm = -113 + 2 * csq_val
            bars = "▂___" if dbm < -110 else "▂▄__" if dbm < -100 else "▂▄▆_" if dbm < -90 else "▂▄▆█"
            print(c(f"  Signal: {bars}  {dbm} dBm (CSQ={csq_val})", GREEN if dbm > -100 else YELLOW))
            if csq_val == 99:
                print(c("  ⚠ CSQ=99 means no signal — SMS will fail", RED))
        except Exception:
            pass

    # ── Send SMS ──────────────────────────────────────────────────────────────
    print(c("\n── Sending SMS ─────────────────────────────────────────────", CYAN))
    success = send_sms(ser, args.number, args.message)

    # ── Result ───────────────────────────────────────────────────────────────
    print()
    if success:
        print(c("╔═══════════════════════════════════════╗", GREEN))
        print(c(f"║  ✓ SMS sent to {args.number}!", GREEN) + c("            ║", GREEN))
        print(c(f'║  Message: "{args.message}"', GREEN))
        print(c("╚═══════════════════════════════════════╝", GREEN))
    else:
        print(c("╔═══════════════════════════════════════╗", RED))
        print(c("║  ✗ SMS failed. See errors above.      ║", RED))
        print(c("╚═══════════════════════════════════════╝", RED))
        print(textwrap.dedent("""
  Common fixes:
    • SIM800L needs 5 V supply (not 3.3 V from ESP)
    • Jio SIMs are 4G-only → SIM800L won't register (use Airtel/Vi/BSNL)
    • Check 1000µF bulk cap across SIM800L VCC/GND
    • TX/RX must be crossed: SIM800 TX→GPIO17, SIM800 RX→GPIO18
    • Some operators block SMS from modems → check with phone first
        """))
    ser.close()

if __name__ == "__main__":
    main()
