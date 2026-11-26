import machine, time, ustruct

print('=== 1. SCANNING I2C FOR MPU6050 (SDA=8, SCL=9) ===')
try:
    i2c = machine.I2C(0, sda=machine.Pin(8), scl=machine.Pin(9), freq=400000)
    devices = i2c.scan()
    print('I2C Scan Devices found (hex):', [hex(d) for d in devices])
    if 0x68 in devices or 0x69 in devices:
        addr = 0x68 if 0x68 in devices else 0x69
        print('MPU6050 found at address:', hex(addr))
        who_am_i = i2c.readfrom_mem(addr, 0x75, 1)[0]
        print('WHO_AM_I register (0x75):', hex(who_am_i))
        # Wake up MPU-6050
        i2c.writeto_mem(addr, 0x6B, b'\x00')
        time.sleep(0.05)
        # Read Accel (0x3B..0x40)
        data = i2c.readfrom_mem(addr, 0x3B, 14)
        ax, ay, az, temp_raw, gx, gy, gz = ustruct.unpack('>hhhhhhh', data)
        print('Live Accel (g): ax={:.3f}, ay={:.3f}, az={:.3f}'.format(ax/16384.0, ay/16384.0, az/16384.0))
        print('Live Gyro (deg/s): gx={:.2f}, gy={:.2f}, gz={:.2f}'.format(gx/131.0, gy/131.0, gz/131.0))
        print('Live Temp (C): {:.2f}'.format(temp_raw/340.0 + 36.53))
    else:
        print('No I2C device found on GPIO 8 & 9.')
except Exception as e:
    print('I2C Error:', e)

print('\n=== 2. PIN VOLTAGE CHECK ON GPIO 17 & 18 ===')
try:
    p17 = machine.Pin(17, machine.Pin.IN)
    p18 = machine.Pin(18, machine.Pin.IN)
    print('GPIO 17 (SIM_RX):', p17.value())
    print('GPIO 18 (SIM_TX):', p18.value())
except Exception as e:
    print('Pin check error:', e)

print('\n=== 3. TESTING SIM800L ON UART1 (RX=17, TX=18) ===')
for baud in [9600, 115200, 19200]:
    try:
        u = machine.UART(1, baudrate=baud, rx=17, tx=18, timeout=1000)
        while u.any():
            u.read()
        u.write(b'AT\r\n')
        time.sleep(0.6)
        resp = u.read()
        print('Baud', baud, '-> Response:', repr(resp))
        if resp and b'OK' in resp:
            print('-> SIM800L Handshake SUCCESS at', baud)
            u.write(b'AT+CPIN?\r\n')
            time.sleep(0.8)
            print('CPIN response:', repr(u.read()))
            u.write(b'AT+CSQ\r\n')
            time.sleep(0.8)
            print('CSQ response:', repr(u.read()))
            u.write(b'AT+CREG?\r\n')
            time.sleep(0.8)
            print('CREG response:', repr(u.read()))
            break
    except Exception as e:
        print('UART error at', baud, ':', e)

print('\n=== 4. TESTING GPS ON GPIO 16 (UART2, 9600) ===')
try:
    gps_u = machine.UART(2, baudrate=9600, rx=16, timeout=1000)
    time.sleep(1.5)
    gps_data = gps_u.read()
    print('GPS UART response (first 200 bytes):', repr(gps_data[:200] if gps_data else None))
except Exception as e:
    print('GPS UART error:', e)
