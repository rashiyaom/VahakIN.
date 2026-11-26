#!/usr/bin/env python3
"""Create private local demo certificates. Does not install trust or start any server."""
import argparse
import ipaddress
import os
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('--ip', help='Laptop hotspot IPv4 (defaults to en0 on macOS)')
args = parser.parse_args()
try:
    value = args.ip or subprocess.check_output(['ipconfig', 'getifaddr', 'en0'], text=True).strip()
    ip = ipaddress.IPv4Address(value)
except (ValueError, subprocess.CalledProcessError, FileNotFoundError):
    parser.error('Join the hotspot or supply --ip with the laptop Wi-Fi IPv4')
if not any(ip in ipaddress.IPv4Network(net) for net in ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']):
    parser.error('Use a private LAN IPv4')
os.umask(0o077)
folder = Path(__file__).resolve().parents[1] / 'apps/web/.local-https'
folder.mkdir(mode=0o700, exist_ok=True)

def openssl(*args):
    result = subprocess.run(['openssl', *args], cwd=folder, capture_output=True, text=True)
    if result.returncode:
        raise SystemExit('OpenSSL certificate preparation failed: ' + result.stderr)

ca = folder / 'rootCA.crt'
key = folder / 'rootCA.key'
if ca.exists() != key.exists():
    raise SystemExit('Incomplete local CA. Restore the matching private key/certificate before proceeding.')
if not ca.exists():
    (folder / 'ca.cnf').write_text('''[req]
prompt=no
distinguished_name=dn
x509_extensions=ca
[dn]
CN=VahakIN Local Demo CA
[ca]
basicConstraints=critical,CA:TRUE,pathlen:0
keyUsage=critical,keyCertSign,cRLSign
subjectKeyIdentifier=hash
''')
    openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-days', '365', '-config', 'ca.cnf', '-keyout', 'rootCA.key', '-out', 'rootCA.crt')
openssl('x509', '-in', 'rootCA.crt', '-checkend', '2592000', '-noout')
(folder / 'server.cnf').write_text(f'''[req]
prompt=no
distinguished_name=dn
[dn]
CN={ip}
[server]
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=IP:{ip},IP:127.0.0.1,DNS:localhost
''')
openssl('req', '-new', '-newkey', 'rsa:2048', '-nodes', '-sha256', '-config', 'server.cnf', '-keyout', 'server.key', '-out', 'server.csr')
openssl('x509', '-req', '-in', 'server.csr', '-CA', 'rootCA.crt', '-CAkey', 'rootCA.key', '-CAcreateserial', '-out', 'server.crt', '-days', '30', '-sha256', '-extfile', 'server.cnf', '-extensions', 'server')
openssl('verify', '-CAfile', 'rootCA.crt', 'server.crt')
print(f'Prepared HTTPS for https://{ip}:3443. No system trust settings were changed.')
print('Transfer only apps/web/.local-https/rootCA.crt to the phone and explicitly trust it for this demo.')
print('From apps/web, run:')
print('VAHAKIN_BUILD_DIR=.next-phone node node_modules/next/dist/bin/next dev --hostname 0.0.0.0 --port 3443 --experimental-https --experimental-https-key .local-https/server.key --experimental-https-cert .local-https/server.crt --experimental-https-ca .local-https/rootCA.crt')
