import { test, expect, type APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomUUID, createHash, createHmac } from 'node:crypto';
const origin=process.env.VAHAKIN_TEST_URL||'http://localhost:3001';
const future=(days:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+days*86400000));
test('live onboarding, private evidence, independent approval and signed hardware',async({page,browser})=>{
 test.skip(process.env.VAHAKIN_LIVE_TESTS!=='1','Opt in to create and remove temporary Supabase fixtures.');test.setTimeout(240000);
 const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
 const suffix=randomUUID().slice(0,8),password=`Test-${randomUUID()}!`,deviceId=`IG-TEST-${suffix.toUpperCase()}`,code=randomUUID(),secret=createHash('sha256').update(randomUUID()).digest('hex');
 const users:string[]=[],emails:string[]=[];
 const reviewer=await browser.newContext({baseURL:origin}),other=await browser.newContext({baseURL:origin});
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 async function post(request:APIRequestContext,url:string,data:unknown){const r=await request.post(url,{headers:{Origin:origin},data});expect(r.status(),await r.text()).toBe(200);return r.json();}
 async function app(){return(await(await page.request.get('/api/applications')).json()).applications[0];}
 try{
  for(const role of ['owner','reviewer','other']){const email=`ig-test-${suffix}-${role}@example.com`;emails.push(email);const{data,error}=await db.auth.admin.createUser({email,password,email_confirm:role!=='owner',user_metadata:{full_name:'Integration Test',role:'rto_admin'}});expect(error).toBeNull();users.push(data.user!.id);}
  expect((await db.from('ig_profiles').select('role').eq('id',users[0]).single()).data?.role).toBe('vehicle_owner');
  expect((await page.request.post('/api/session',{headers:{Origin:origin},data:{email:emails[0],password}})).status()).toBe(401);
  const confirmation=await db.auth.admin.generateLink({type:'signup',email:emails[0],password});expect(confirmation.error).toBeNull();
  await page.goto(`/auth/callback?token_hash=${confirmation.data.properties!.hashed_token}&type=signup`);await page.waitForURL('**/owner/onboarding');
  await expect(page.getByRole('heading',{name:'Your device',exact:true})).toBeVisible();await expect(page.getByText('DEMO WORKSPACE')).toHaveCount(0);await expect(page.getByRole('button',{name:'Use sample device details'})).toHaveCount(0);
  expect((await db.from('ig_profiles').update({role:'rto_admin',state:'Gujarat',office:'GJ-03'}).eq('id',users[1])).error).toBeNull();
  await post(reviewer.request,'/api/session',{email:emails[1],password,portal:'government'});await post(other.request,'/api/session',{email:emails[2],password});
  expect((await page.request.post('/api/session',{headers:{Origin:origin},data:{mode:'demo',accountId:'demo-rto'}})).status()).toBe(403);expect((await page.request.get('/demo',{maxRedirects:0})).status()).toBe(307);
  expect((await db.rpc('ig_provision_device',{p_id:deviceId,p_serial:`TEST-${suffix}`,p_claim_hash:createHash('sha256').update(code).digest('hex'),p_secret:secret})).error).toBeNull();
  await page.getByLabel('Device ID',{exact:true}).fill(deviceId);await page.getByLabel('Activation code',{exact:true}).fill(code);await page.getByRole('button',{name:'Claim device',exact:true}).click();await expect(page.getByText(`${deviceId} is reserved for you`)).toBeVisible();
  const first=await app();expect((await reviewer.request.get('/api/applications').then(r=>r.json())).applications.some((a:{id:string})=>a.id===first.id)).toBe(false);
  expect((await page.request.post('/api/applications',{headers:{Origin:origin},data:{action:'demo-setup',id:first.id,version:first.version}})).status()).toBe(403);
  const fields={...first.fields,fullName:'Integration Test Owner',mobile:'9876543210',address:'Test address Rajkot city',ownerPincode:'360001',registration:`GJ03Z${suffix.slice(0,4).replace(/[a-f]/g,'7')}`,model:'Test goods vehicle',chassis:'TESTCHASSIS2026',year:'2024',taxReference:'TEST-TAX-123',taxAuthority:'Rajkot RTO',taxPaidThrough:future(90),startsOn:future(2),endsOn:future(20),reasonDetails:'Planned test maintenance in workshop',parkingAddress:'Test garage plot 12 Rajkot city',area:'Rajkot city',parkingPincode:'360001',declarationAccepted:false};
  await post(page.request,'/api/applications',{action:'save',id:first.id,version:first.version,fields,step:4});expect((await page.request.post('/api/applications',{headers:{Origin:origin},data:{action:'save',id:first.id,version:first.version,fields,step:4}})).status()).toBe(409);
  await page.reload();const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<</Type /Catalog>>\nendobj\ntrailer\n<</Root 1 0 R>>\n%%EOF');
  for(const label of ['Registration certificate (RC)','Certificate of taxation / tax receipt','Signed Form NT','Fitness certificate']){await page.getByLabel(`Upload ${label}`,{exact:true}).setInputFiles({name:'test.pdf',mimeType:'application/pdf',buffer:pdf});await expect(page.getByRole('status').filter({hasText:`${label} uploaded.`})).toBeVisible();}
  let current=await app();const document=current.documents[0];
  for(const request of [other.request,reviewer.request])expect((await request.get(`/api/applications/documents/${document.id}`)).status()).toBe(404);expect((await page.request.get(`/api/applications/documents/${document.id}`)).status()).toBe(200);
  const publicClient=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false}});
  expect((await publicClient.from('ig_devices').select('*')).error).not.toBeNull();expect((await publicClient.storage.from('vahakin-documents').download(document.storagePath)).error).not.toBeNull();
  expect((await publicClient.auth.signInWithPassword({email:emails[0],password})).error).toBeNull();expect((await publicClient.from('ig_profiles').update({role:'rto_admin'}).eq('id',users[0])).error).not.toBeNull();expect((await publicClient.rpc('ig_commit_workspace',{p_actor:users[0],p_expected:0,p_changes:[]})).error).not.toBeNull();expect((await publicClient.from('ig_applications').select('owner_id')).data?.every(a=>a.owner_id===users[0])).toBe(true);
  await page.getByRole('button',{name:'Save & continue'}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Send to Rajkot RTO',exact:true}).click();await expect(page.getByRole('heading',{name:'You’re in the review queue.'})).toBeVisible();
  expect((await reviewer.request.get(`/api/applications/documents/${document.id}`)).status()).toBe(200);current=await app();
  expect((await page.request.post('/api/applications',{headers:{Origin:origin},data:{action:'review',id:current.id,version:current.version,decision:'approve',note:'Owner cannot approve',checks:{identity:true,ownership:true,documents:true,jurisdiction:true}}})).status()).toBe(403);
  await post(reviewer.request,'/api/applications',{action:'review',id:current.id,version:current.version,decision:'changes',note:'Please clarify the parking address.'});current=await app();
  await post(page.request,'/api/applications',{action:'save',id:current.id,version:current.version,fields:{...current.fields,parkingAddress:'Updated test parking address, Rajkot city',declarationAccepted:true},step:5});current=await app();
  expect((await reviewer.request.get('/api/applications').then(r=>r.json())).applications.find((a:{id:string})=>a.id===current.id).fields.parkingAddress).toBe(fields.parkingAddress);
  await post(page.request,'/api/applications',{action:'submit',id:current.id,version:current.version});current=await app();
  await post(reviewer.request,'/api/applications',{action:'review',id:current.id,version:current.version,decision:'approve',note:'Test package reviewed independently.',checks:{identity:true,ownership:true,documents:true,jurisdiction:true}});current=await app();expect(current.status).toBe('Approved');expect(current.vehicleId).toBeTruthy();expect(current.revisions).toHaveLength(2);
  expect((await reviewer.request.post('/api/applications',{headers:{Origin:origin},data:{action:'verify-installation',id:current.id,version:current.version,note:'Physical mounting and seal checked.'}})).status()).toBe(400);
  const body=JSON.stringify({deviceId,timestamp:Date.now(),nonce:randomUUID()});expect((await page.request.post('/api/devices/heartbeat',{data:body,headers:{'Content-Type':'application/json','x-vahakin-signature':'0'.repeat(64)}})).status()).toBe(401);
  const headers={'Content-Type':'application/json','x-vahakin-signature':createHmac('sha256',secret).update(body).digest('hex')};expect((await page.request.post('/api/devices/heartbeat',{data:body,headers})).status()).toBe(200);expect((await page.request.post('/api/devices/heartbeat',{data:body,headers})).status()).toBe(409);
  current=await app();await post(reviewer.request,'/api/applications',{action:'verify-installation',id:current.id,version:current.version,note:'Physical mounting and seal checked.'});
  await page.goto('/owner/vehicles');await expect(page.getByText(fields.registration,{exact:true}).first()).toBeVisible();await expect(page.getByText('MOCK',{exact:true})).toHaveCount(0);expect((await db.from('ig_vehicles').select('payload').eq('id',current.vehicleId).single()).data?.payload.source).toBe('MANUAL');
  await page.request.delete('/api/session',{headers:{Origin:origin}});await page.goto('/login/owner');await page.getByLabel('Email address',{exact:true}).fill(emails[0]);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in to your workspace'}).click();await page.waitForURL('**/owner');await page.screenshot({path:'/tmp/vahakin-live-owner.png',fullPage:true});expect(errors).toEqual([]);
  expect((await db.from('ig_staff_grants').select('role,office').eq('email','rashiyaom@gmail.com').single()).data).toEqual({role:'rto_admin',office:'GJ-03'});
 }finally{
  const apps=await db.from('ig_applications').select('id').in('owner_id',users);const docs=await db.from('ig_documents').select('payload').in('application_id',(apps.data??[]).map(a=>a.id));const paths=(docs.data??[]).map(d=>d.payload.storagePath).filter(Boolean);if(paths.length)expect((await db.storage.from('vahakin-documents').remove(paths)).error).toBeNull();
  for(const table of ['ig_device_nonces','ig_device_credentials'])await db.from(table).delete().eq('device_id',deviceId);await db.from('ig_devices').delete().eq('id',deviceId);await db.from('ig_work_items').delete().in('actor_id',users);await db.from('ig_vehicles').delete().in('owner_id',users);for(const id of users)expect((await db.auth.admin.deleteUser(id)).error).toBeNull();await reviewer.close();await other.close();
 }
});
