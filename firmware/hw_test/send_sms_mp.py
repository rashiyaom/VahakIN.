import machine, time

u = machine.UART(1, baudrate=9600, rx=17, tx=18, timeout=2000)

def cmd(at_str, wait_sec=1):
    while u.any():
        u.read()
    u.write(at_str.encode() + b"\r\n")
    time.sleep(wait_sec)
    r = u.read()
    resp_text = str(r) if r else "None"
    print(at_str + " -> " + resp_text)
    return resp_text

print("=== CHECKING SIM800L STATUS ===")
cmd("AT", 1)
cmd("ATE0", 1)
cmd("AT+CPIN?", 1)
cmd("AT+CSQ", 1)
cmd("AT+COPS?", 2)

print("\n=== CHECKING NETWORK REGISTRATION (CREG) ===")
for i in range(10):
    res = cmd("AT+CREG?", 1)
    if "0,1" in res or "0,5" in res or "1,1" in res or "1,5" in res:
        print(">>> NETWORK REGISTERED! <<<")
        break
    time.sleep(1)

print("\n=== CONFIGURING SMS TEXT MODE ===")
cmd("AT+CMGF=1", 1)
cmd('AT+CSCS="GSM"', 1)

print("\n=== SENDING SMS TO 9328087140 ===")
while u.any():
    u.read()
u.write(b'AT+CMGS="+919328087140"\r\n')
time.sleep(1)
p = u.read()
print("CMGS prompt:", str(p))

if p and b'>' in p:
    print("Sending message body...")
    u.write(b"hi i am om this side\x1a")
    time.sleep(6)
    res = u.read()
    print("Send result:", str(res))
else:
    print("No prompt received")
