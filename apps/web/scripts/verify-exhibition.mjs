import {createClient} from '@supabase/supabase-js';
import {readFile} from 'node:fs/promises';
const creds=JSON.parse(await readFile('.provisioned/exhibition-login.json','utf8'));
const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
const login=await c.auth.signInWithPassword(creds);if(login.error)throw Error(login.error.message);
const p=await c.from('ig_profiles').select('role,office').eq('id',login.data.user.id).single();
if(p.error||p.data.role!=='rto_admin'||p.data.office!=='GJ-21')throw Error('Government access mismatch');
console.log('Password login verified; rto_admin / GJ-21.');
await c.auth.signOut();
