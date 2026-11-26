// Run from apps/web: node --env-file=.env.local scripts/provision-device.mjs IG-SERIAL123 SERIAL123
import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const [deviceId, serial] = process.argv.slice(2);
if (!/^IG-[A-Z0-9-]{4,80}$/.test(deviceId ?? '') || !serial || serial.length > 100) throw new Error('Usage: provision-device.mjs IG-DEVICE-ID serial-number');
const activationCode = randomBytes(18).toString('base64url'), secret = randomBytes(32).toString('hex');
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
await mkdir('.provisioned', { recursive: true, mode: 0o700 });
// Save credentials before provisioning, so interrupted output cannot lose a unit's key.
const file = `.provisioned/${deviceId}.json`;
await writeFile(file, JSON.stringify({ deviceId, serial, activationCode, secret }, null, 2), { mode: 0o600, flag: 'wx' });
const { error } = await client.rpc('ig_provision_device', { p_id: deviceId, p_serial: serial, p_claim_hash: createHash('sha256').update(activationCode).digest('hex'), p_secret: secret });
if (error) throw new Error(`Provisioning failed (${error.code}); inspect the private credential file before retrying.`);
console.log(`Provisioned ${deviceId}. Private credentials saved to ${file}. Print only the activation code on the owner card; install the secret in the device.`);
