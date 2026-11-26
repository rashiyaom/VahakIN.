#!/usr/bin/env python3
"""Refresh the private ESP endpoint after joining the phone hotspot; never prints secrets."""
import argparse
import ipaddress
import re
import subprocess
from pathlib import Path
parser = argparse.ArgumentParser()
parser.add_argument('--device', choices=['basic', 'plus'], default='basic')
parser.add_argument('--port', type=int, default=3000)
parser.add_argument('--ip', help='Laptop private Wi-Fi IPv4; auto-detects en0 on macOS if omitted')
args = parser.parse_args()
if not 1 <= args.port <= 65535:
    parser.error('Port must be 1–65535')
try:
    value = args.ip or subprocess.check_output(['ipconfig', 'getifaddr', 'en0'], text=True).strip()
    ip = ipaddress.IPv4Address(value)
except (ValueError, subprocess.CalledProcessError, FileNotFoundError):
    parser.error('Connect the laptop to the hotspot, or pass --ip with its Wi-Fi IPv4 address')
if not any(ip in ipaddress.IPv4Network(net) for net in ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']):
    parser.error('Use a private LAN IPv4 address')
path = Path(__file__).resolve().parents[1] / f'firmware/{"plus_watch_demo" if args.device == "plus" else "hotspot_imu_demo"}/config.local.h'
if not path.exists():
    parser.error('Provision config.local.h first; see the firmware README')
url = f'http://{ip}:{args.port}/api/devices/telemetry'
content, count = re.subn(r'^#define TELEMETRY_URL .*$', f'#define TELEMETRY_URL "{url}"', path.read_text(), flags=re.M)
if count != 1:
    parser.error('Expected exactly one TELEMETRY_URL in config.local.h')
path.write_text(content)
path.chmod(0o600)
print(f'Private firmware endpoint updated to {url}. Recompile before flashing.')
