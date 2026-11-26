import machine, time

# --- 1. I2C SCAN ---
print("=== 1. I2C SCAN (MPU6050) ===")
found_i2c = []
# Try 8 (SDA), 9 (SCL)
try:
    i2c = machine.I2C(0, sda=machine.Pin(8), scl=machine.Pin(9), freq=100000)
    devs = i2c.scan()
    print("Default 8 (SDA), 9 (SCL):", [hex(d) for d in devs])
    if devs:
        found_i2c.append((8, 9, devs))
except Exception as e:
    print("I2C 8/9 error:", e)

# Try swapped 9 (SDA), 8 (SCL)
try:
    i2c = machine.I2C(0, sda=machine.Pin(9), scl=machine.Pin(8), freq=100000)
    devs = i2c.scan()
    print("Swapped 9 (SDA), 8 (SCL):", [hex(d) for d in devs])
    if devs:
        found_i2c.append((9, 8, devs))
except Exception as e:
    pass

# Try pullups
for p1, p2 in [(8, 9), (9, 8), (4, 5), (1, 2), (21, 22)]:
    try:
        i2c = machine.I2C(0, sda=machine.Pin(p1, machine.Pin.IN, machine.Pin.PULL_UP), scl=machine.Pin(p2, machine.Pin.IN, machine.Pin.PULL_UP), freq=100000)
        devs = i2c.scan()
        if devs:
            print("Found on", p1, p2, ":", [hex(d) for d in devs])
            found_i2c.append((p1, p2, devs))
    except Exception:
        pass

if not found_i2c:
    print("No I2C devices responded. Check MPU-6050 VCC (needs 3.3V) and GND.")

# --- 2. SIM800L NETWORK CHECK & SMS ---
print("\n=== 2. SIM800L NETWORK & SMS ===")
u = machine.UART(1, baudrate=9600, rx=17, tx=18, timeout=2000)

def cmd(at_str, wait_sec=1.0):
    while u.any():
        u.read()
    u.write((at_str + "\r\n").encode())
    time.sleep(wait_sec)
    r = u.read()
    resp_text = r.decode("utf-8", errors="replace").strip() if r else "None"
    print("  " + at_str + " -> " + repr(resp_text))
    return resp_text

cmd("AT")
cmd("ATE0")
cmd("AT+CPIN?")
cmd("AT+CSQ")
cmd("AT+COPS?")

# Poll CREG up to 15 seconds
reg = False
for i in range(15):
    r = cmd("AT+CREG?", 0.8)
    if "+CREG: 0,1" in r or "+CREG: 0,5" in r or "+CREG: 1,1" in r or "+CREG: 1,5" in r:
        print("-> Network REGISTERED! Status:", r)
        reg = True
        break
    time.sleep(1)

if not reg:
    print("-> Still searching for network. Operator signal quality:")
    cmd("AT+CSQ")
    cmd("AT+COPS=?")

# Configure SMS text mode
cmd("AT+CMGF=1")
cmd('AT+CSCS="GSM"')

# Attempt SMS Send
print("\nAttempting to send SMS to 9328087140...")
while u.any():
    u.read()
u.write(b'AT+CMGS="+919328087140"\r\n')
time.sleep(1.5)
resp_prompt = u.read()
prompt_text = resp_prompt.decode("utf-8", errors="replace") if resp_prompt else ""
print("CMGS Prompt response:", repr(prompt_text))

if ">" in prompt_text:
    print("Got '>' prompt! Transmitting SMS text body + Ctrl-Z...")
    u.write(b"hi i am om this side\x1a")
    time.sleep(8)
    sms_res = u.read()
    res_text = sms_res.decode("utf-8", errors="replace") if sms_res else ""
    print("SMS Send Result:", repr(res_text))
    if "+CMGS:" in res_text:
        print(">>> SMS SENT SUCCESSFULLY! <<<")
    else:
        print(">>> SMS SEND FAILED or pending. Response:", res_text)
else:
    print("Did not receive '>' prompt. Error code above.")
