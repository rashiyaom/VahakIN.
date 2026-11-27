import {spawnSync} from 'node:child_process';
const keys=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY','VAHAKIN_DEMO_EMAIL','VAHAKIN_DEMO_PASSWORD_SHA256','TRANSPORT_RECORDS_MODE','NEXT_PUBLIC_MAPTILER_KEY'];
for(const key of keys){if(!process.env[key])continue;const r=spawnSync('vercel',['env','add',key,'production','--force'],{input:process.env[key],encoding:'utf8'});if(r.status!==0)throw Error(`Environment setup failed for ${key}`);console.log(`Configured ${key}`);}
