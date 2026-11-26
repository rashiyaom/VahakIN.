// Run from apps/web with node --env-file=.env.local scripts/provision-hotspot-demo.mjs
// Fixed owner label; the independent telemetry key is random and never printed.
import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const tier=process.argv[2]??'basic';
if(!['basic','plus'].includes(tier))throw new Error('Use basic or plus');
const plus=tier==='plus';
const deviceId=plus?'IG-PLUS-0001':'IG-DEMO-0001', serial=plus?'WAVESHARE-S3-AMOLED206-001':'ESP32S3-MPU6050-NEO6M-001', activationCode=plus?'VAHAKIN-PLUS-2026':'VAHAKIN-2026';
const file=`.provisioned/${deviceId}.json`;
await mkdir('.provisioned',{recursive:true,mode:0o700});
let credentials;
try {credentials=JSON.parse(await readFile(file,'utf8'));} catch(e) {
  if(e.code!=='ENOENT')throw e;
  credentials={deviceId,serial,activationCode,secret:randomBytes(32).toString('hex')};
  await writeFile(file,JSON.stringify(credentials,null,2),{mode:0o600,flag:'wx'});
}
if(credentials.deviceId!==deviceId||credentials.activationCode!==activationCode||!/^[a-f0-9]{64}$/.test(credentials.secret))throw new Error('Private provisioning record mismatch. No database changes made.');
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const claimHash=createHash('sha256').update(activationCode).digest('hex');
const existing=await client.from('ig_devices').select('id,claim_hash,payload').eq('id',deviceId).maybeSingle();
if(existing.error)throw new Error(`Inventory lookup failed: ${existing.error.code}`);
if(existing.data){
  const key=await client.from('ig_device_credentials').select('secret').eq('device_id',deviceId).single();
  if((existing.data.payload.tier??"BASIC")!==tier.toUpperCase()||existing.data.claim_hash!==claimHash||key.error||key.data.secret!==credentials.secret)throw new Error('Device already exists with different credentials. Refusing to overwrite it.');
}else{
  const result=await client.rpc('ig_provision_product',{p_id:deviceId,p_serial:serial,p_claim_hash:claimHash,p_secret:credentials.secret,p_tier:tier.toUpperCase()});
  if(result.error)throw new Error(`Provisioning failed: ${result.error.code}`);
}
const path=`../../firmware/${plus?'plus_watch_demo':'hotspot_imu_demo'}/config.local.h`;
let config=await readFile(path,'utf8');
config=config.replace(/^#define DEVICE_SECRET .*$/m,`#define DEVICE_SECRET "${credentials.secret}"`);
await writeFile(path,config,{mode:0o600});
console.log(`Registered ${deviceId}. Label activation code: ${activationCode}. Private firmware key saved locally; no assignment was changed.`);
