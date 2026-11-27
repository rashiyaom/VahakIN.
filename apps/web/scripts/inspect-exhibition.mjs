import {createClient} from '@supabase/supabase-js';
const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
for(const email of ['rashiyaom@gmail.com','devanshi1712p@gmail.com']){
 const {data,error}=await c.from('ig_profiles').select('*').eq('email',email);console.log(JSON.stringify({email,profiles:data,error:error?.message}));
 for(const p of data??[]){const a=await c.from('ig_applications').select('id,payload').eq('owner_id',p.id);console.log(JSON.stringify({applications:a.data,error:a.error?.message}));}
}
const d=await c.from('ig_devices').select('id,payload').eq('id','IG-PLUS-0001');console.log(JSON.stringify({device:d.data,error:d.error?.message}));
const g=await c.from('ig_staff_grants').select('*').eq('email','rashiyaom@gmail.com');console.log(JSON.stringify({grant:g.data,error:g.error?.message}));
