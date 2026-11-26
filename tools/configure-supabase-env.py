"""Configure ignored local environment without printing Supabase secrets."""
import hashlib
import json
import os
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[1]
ref = "sxpbvgwozrdtvjplenzd"
result = subprocess.run(["supabase", "projects", "api-keys", f"--remote={ref}", "--reveal", "--output", "json"], capture_output=True, text=True, check=True)
data = json.loads(result.stdout)
keys = data if isinstance(data, list) else data.get("keys", data.get("api_keys", []))
secret = next((k.get("api_key", k.get("key", "")) for k in keys if k.get("name") == "service_role"), None)
if not secret:
    secret = next((k.get("api_key", k.get("key", "")) for k in keys if k.get("type") == "secret"), None)
if not secret:
    raise SystemExit("No server API key returned. No environment file changed.")
target = root / "apps/web/.env.local"
values = {}
if target.exists():
    for line in target.read_text().splitlines():
        if line and not line.startswith("#") and "=" in line:
            name, value = line.split("=", 1)
            values[name] = value
values.update({
    "NEXT_PUBLIC_SUPABASE_URL": f"https://{ref}.supabase.co",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": "sb_publishable_ivK-saSBWEqisUbZ-o0OPA_urxI0IFB",
    "SUPABASE_SERVICE_ROLE_KEY": secret,
    "VAHAKIN_DEMO_EMAIL": "demo@gmail.com",
    "VAHAKIN_DEMO_PASSWORD_SHA256": hashlib.sha256(b"demo@123").hexdigest(),
    "TRANSPORT_RECORDS_MODE": "MANUAL",
})
target.write_text("\n".join(f"{k}={v}" for k, v in values.items()) + "\n")
os.chmod(target, 0o600)
print("Configured public connection settings and server-only credentials in ignored apps/web/.env.local. Secret values were not printed.")
