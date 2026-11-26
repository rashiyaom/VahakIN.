"""Run once in MicroPython RAM: SIM800L on ESP RX17 / TX18, 9600 baud."""
import machine, time
u = machine.UART(1, baudrate=9600, rx=17, tx=18, timeout=100)
def receive(seconds, prompt=False):
    result=b''; start=time.ticks_ms()
    while time.ticks_diff(time.ticks_ms(),start)<seconds*1000:
        if u.any():
            result+=u.read()
            if (prompt and b'>' in result) or b'\r\nOK\r\n' in result or b'ERROR' in result:break
        time.sleep_ms(50)
    return result
def command(value,seconds=3):
    while u.any():u.read()
    u.write(value+'\r\n');r=receive(seconds);print(value,repr(r));return r
def main():
    if b'OK' not in command('AT'):print('STOP: modem not responding');return
    command('ATE0');command('AT+CMEE=2')
    if b'READY' not in command('AT+CPIN?'):print('STOP: SIM not ready');return
    command('AT+CSQ');command('AT+COPS?',5)
    registered=False
    for _ in range(8):
        r=str(command('AT+CREG?')).replace(' ','')
        if any('+CREG:'+str(n)+','+str(status) in r for n in (0,1,2) for status in (1,5)):
            registered=True;break
        time.sleep(2)
    if not registered:print('STOP: SIM not registered');return
    if b'OK' not in command('AT+CMGF=1'):return
    if b'OK' not in command('AT+CSCS="GSM"'):return
    u.write('AT+CMGS="+919979849200"\r\n');r=receive(5,True);print('SMS prompt:',repr(r))
    if b'>' not in r:print('STOP: no SMS prompt');return
    u.write(b'VahanIN demo: ESP32-S3 and SIM800L SMS test. This is a test message only.\x1a')
    r=receive(45);print('Submission response:',repr(r))
    print('SUBMITTED TO NETWORK' if b'+CMGS:' in r and b'OK' in r else 'NOT CONFIRMED - do not retry automatically')
main()
