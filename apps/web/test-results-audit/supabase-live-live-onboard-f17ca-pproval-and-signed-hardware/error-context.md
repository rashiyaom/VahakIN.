# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: supabase-live.spec.ts >> live onboarding, private evidence, independent approval and signed hardware
- Location: tests/e2e/supabase-live.spec.ts:6:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'You’re in the review queue.' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'You’re in the review queue.' }) with timeout 5000ms
  - waiting for getByRole('heading', { name: 'You’re in the review queue.' })

```

```yaml
- complementary:
  - link "VahakIN home":
    - /url: /
    - text: VahakIN.
  - button "Close navigation":
    - img
  - img
  - text: Owner workspace Application setup
  - img
  - navigation "Workspace navigation":
    - paragraph: Workspace
    - link "Applications":
      - /url: /owner/applications?range=30&state=all&office=all&status=all
      - img
      - text: Applications
  - text: IT
  - strong: Integration Test
  - text: Vehicle Owner
  - button "Sign out":
    - img
- banner:
  - link "VahakIN home":
    - /url: /
    - text: VahakIN.
  - navigation "Main workspace sections":
    - link "Applications":
      - /url: /owner/applications?range=30&state=all&office=all&status=all
      - img
      - text: Applications
  - button "Switch to dark mode"
  - button "Open navigation":
    - img
  - link "0 alerts":
    - /url: /owner/alerts?range=30&state=all&office=all&status=all
    - img
  - button "Sign out":
    - img
  - text: IT
- main:
  - text: Vehicle Owner / Application setup
  - heading "Let’s get you connected." [level=1]
  - paragraph: Your device, your details, your review. A simple start to a shared connection.
  - button "Refresh workspace":
    - img
    - text: Refresh
  - region "Owner enrolment":
    - complementary:
      - paragraph: A LITTLE CLOSER TO READY
      - heading "Your vehicle. In good hands." [level=2]
      - paragraph: One step at a time. Your progress is saved when you continue.
      - list:
        - listitem:
          - button "Your device" [disabled]:
            - img
            - text: Your device
        - listitem:
          - button "About you" [disabled]:
            - img
            - text: About you
        - listitem:
          - button "Your vehicle" [disabled]:
            - img
            - text: Your vehicle
        - listitem:
          - button "Parking & dates" [disabled]:
            - img
            - text: Parking & dates
        - listitem:
          - button "Documents" [disabled]:
            - img
            - text: Documents
        - listitem:
          - button "6 Review & send" [disabled]
      - img
      - text: Your documents stay within your application and its authorized review team.
    - group:
      - paragraph: STEP 6 OF 6 · Saved draft
      - heading "Review & send" [level=2]
      - paragraph: Everything together. Take a moment to check it.
      - img
      - heading "Device" [level=3]
      - button "Edit" [disabled]
      - term: Device ID
      - definition: IG-TEST-64D3A62C
      - term: Connection
      - definition: Installation and authenticated monitoring verified separately
      - heading "Applicant" [level=3]
      - button "Edit" [disabled]
      - term: Name
      - definition: Integration Test Owner
      - term: Applying as
      - definition: Registered owner
      - term: Mobile
      - definition: "9876543210"
      - term: Email
      - definition: ig-test-64d3a62c-owner@example.com
      - term: Address
      - definition: Test address Rajkot city · 360001
      - heading "Vehicle & tax record" [level=3]
      - button "Edit" [disabled]
      - term: Registration
      - definition: GJ03Z6473
      - term: Category / model
      - definition: Goods carrier · Test goods vehicle
      - term: Chassis
      - definition: TESTCHASSIS2026
      - term: Year / fuel
      - definition: 2024 · Diesel
      - term: Tax record
      - definition: TEST-TAX-123 · Rajkot RTO
      - term: Tax paid through
      - definition: 24 Feb 2027
      - term: Previous Non-Use
      - definition: None provided
      - heading "Non-Use & parking" [level=3]
      - button "Edit" [disabled]
      - term: Requested period
      - definition: 28 Nov 2026 – 16 Dec 2026
      - term: Reason
      - definition: "Planned non-use: Planned test maintenance in workshop"
      - term: Parking address
      - definition: Test garage plot 12 Rajkot city · 360001
      - term: District / area
      - definition: Rajkot · Rajkot city
      - term: Parking coordinates
      - definition: To be verified at installation
      - term: Review office
      - definition: Rajkot RTO · GJ-03
      - checkbox "I confirm these details are accurate for this application. I understand that submission is not approval or tax exemption, and that vehicle movement during an approved Non-Use period requires the relevant authority’s permission." [checked] [disabled]
      - text: I confirm these details are accurate for this application. I understand that submission is not approval or tax exemption, and that vehicle movement during an approved Non-Use period requires the relevant authority’s permission.
      - paragraph: Your signed Form NT is included in the package. This checkbox is an application acknowledgment, not a government digital signature.
      - button "Back" [disabled]
      - button "Save draft" [disabled]:
        - img
        - text: Save draft
      - button "Send to Rajkot RTO" [disabled]:
        - img
        - text: Send to Rajkot RTO
    - status: Saving your application…
  - text: "Account active · Source: MANUAL · Polling every 30s Registry snapshot: 26 Nov, 17:58 IST · VahanIN prototype"
- alert
```

# Test source

```ts
  1  | import { test, expect, type APIRequestContext } from '@playwright/test';
  2  | import { createClient } from '@supabase/supabase-js';
  3  | import { randomUUID, createHash, createHmac } from 'node:crypto';
  4  | const origin=process.env.VAHAKIN_TEST_URL||'http://localhost:3001';
  5  | const future=(days:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+days*86400000));
  6  | test('live onboarding, private evidence, independent approval and signed hardware',async({page,browser})=>{
  7  |  test.skip(process.env.VAHAKIN_LIVE_TESTS!=='1','Opt in to create and remove temporary Supabase fixtures.');test.setTimeout(240000);
  8  |  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!,{auth:{persistSession:false}});
  9  |  const suffix=randomUUID().slice(0,8),password=`Test-${randomUUID()}!`,deviceId=`IG-TEST-${suffix.toUpperCase()}`,code=randomUUID(),secret=createHash('sha256').update(randomUUID()).digest('hex');
  10 |  const users:string[]=[],emails:string[]=[];
  11 |  const reviewer=await browser.newContext({baseURL:origin}),other=await browser.newContext({baseURL:origin});
  12 |  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  13 |  async function post(request:APIRequestContext,url:string,data:unknown){const r=await request.post(url,{headers:{Origin:origin},data});expect(r.status(),await r.text()).toBe(200);return r.json();}
  14 |  async function app(){return(await(await page.request.get('/api/applications')).json()).applications[0];}
  15 |  try{
  16 |   for(const role of ['owner','reviewer','other']){const email=`ig-test-${suffix}-${role}@example.com`;emails.push(email);const{data,error}=await db.auth.admin.createUser({email,password,email_confirm:role!=='owner',user_metadata:{full_name:'Integration Test',role:'rto_admin'}});expect(error).toBeNull();users.push(data.user!.id);}
  17 |   expect((await db.from('ig_profiles').select('role').eq('id',users[0]).single()).data?.role).toBe('vehicle_owner');
  18 |   expect((await page.request.post('/api/session',{headers:{Origin:origin},data:{email:emails[0],password}})).status()).toBe(401);
  19 |   const confirmation=await db.auth.admin.generateLink({type:'signup',email:emails[0],password});expect(confirmation.error).toBeNull();
  20 |   await page.goto(`/auth/callback?token_hash=${confirmation.data.properties!.hashed_token}&type=signup`);await page.waitForURL('**/owner/onboarding');
  21 |   await expect(page.getByRole('heading',{name:'Your device',exact:true})).toBeVisible();await expect(page.getByText('DEMO WORKSPACE')).toHaveCount(0);await expect(page.getByRole('button',{name:'Use sample device details'})).toHaveCount(0);
  22 |   expect((await db.from('ig_profiles').update({role:'rto_admin',state:'Gujarat',office:'GJ-03'}).eq('id',users[1])).error).toBeNull();
  23 |   await post(reviewer.request,'/api/session',{email:emails[1],password,portal:'government'});await post(other.request,'/api/session',{email:emails[2],password});
  24 |   expect((await page.request.post('/api/session',{headers:{Origin:origin},data:{mode:'demo',accountId:'demo-rto'}})).status()).toBe(403);expect((await page.request.get('/demo',{maxRedirects:0})).status()).toBe(307);
  25 |   expect((await db.rpc('ig_provision_device',{p_id:deviceId,p_serial:`TEST-${suffix}`,p_claim_hash:createHash('sha256').update(code).digest('hex'),p_secret:secret})).error).toBeNull();
  26 |   await page.getByLabel('Device ID',{exact:true}).fill(deviceId);await page.getByLabel('Activation code',{exact:true}).fill(code);await page.getByRole('button',{name:'Claim device',exact:true}).click();await expect(page.getByText(`${deviceId} is reserved for you`)).toBeVisible();
  27 |   const first=await app();expect((await reviewer.request.get('/api/applications').then(r=>r.json())).applications.some((a:{id:string})=>a.id===first.id)).toBe(false);
  28 |   expect((await page.request.post('/api/applications',{headers:{Origin:origin},data:{action:'demo-setup',id:first.id,version:first.version}})).status()).toBe(403);
  29 |   const fields={...first.fields,fullName:'Integration Test Owner',mobile:'9876543210',address:'Test address Rajkot city',ownerPincode:'360001',registration:`GJ03Z${suffix.slice(0,4).replace(/[a-f]/g,'7')}`,model:'Test goods vehicle',chassis:'TESTCHASSIS2026',year:'2024',taxReference:'TEST-TAX-123',taxAuthority:'Rajkot RTO',taxPaidThrough:future(90),startsOn:future(2),endsOn:future(20),reasonDetails:'Planned test maintenance in workshop',parkingAddress:'Test garage plot 12 Rajkot city',area:'Rajkot city',parkingPincode:'360001',declarationAccepted:false};
  30 |   await post(page.request,'/api/applications',{action:'save',id:first.id,version:first.version,fields,step:4});expect((await page.request.post('/api/applications',{headers:{Origin:origin},data:{action:'save',id:first.id,version:first.version,fields,step:4}})).status()).toBe(409);
  31 |   await page.reload();const pdf=Buffer.from('%PDF-1.4\n1 0 obj\n<</Type /Catalog>>\nendobj\ntrailer\n<</Root 1 0 R>>\n%%EOF');
  32 |   for(const label of ['Registration certificate (RC)','Certificate of taxation / tax receipt','Signed Form NT','Fitness certificate']){await page.getByLabel(`Upload ${label}`,{exact:true}).setInputFiles({name:'test.pdf',mimeType:'application/pdf',buffer:pdf});await expect(page.getByRole('status').filter({hasText:`${label} uploaded.`})).toBeVisible();}
  33 |   let current=await app();const document=current.documents[0];
  34 |   for(const request of [other.request,reviewer.request])expect((await request.get(`/api/applications/documents/${document.id}`)).status()).toBe(404);expect((await page.request.get(`/api/applications/documents/${document.id}`)).status()).toBe(200);
  35 |   const publicClient=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false}});
  36 |   expect((await publicClient.from('ig_devices').select('*')).error).not.toBeNull();expect((await publicClient.storage.from('vahakin-documents').download(document.storagePath)).error).not.toBeNull();
  37 |   expect((await publicClient.auth.signInWithPassword({email:emails[0],password})).error).toBeNull();expect((await publicClient.from('ig_profiles').update({role:'rto_admin'}).eq('id',users[0])).error).not.toBeNull();expect((await publicClient.rpc('ig_commit_workspace',{p_actor:users[0],p_expected:0,p_changes:[]})).error).not.toBeNull();expect((await publicClient.from('ig_applications').select('owner_id')).data?.every(a=>a.owner_id===users[0])).toBe(true);
> 38 |   await page.getByRole('button',{name:'Save & continue'}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Send to Rajkot RTO',exact:true}).click();await expect(page.getByRole('heading',{name:'You’re in the review queue.'})).toBeVisible();
     |                                                                                                                                                                                                                                                                       ^ Error: expect(locator).toBeVisible() failed
  39 |   expect((await reviewer.request.get(`/api/applications/documents/${document.id}`)).status()).toBe(200);current=await app();
  40 |   expect((await page.request.post('/api/applications',{headers:{Origin:origin},data:{action:'review',id:current.id,version:current.version,decision:'approve',note:'Owner cannot approve',checks:{identity:true,ownership:true,documents:true,jurisdiction:true}}})).status()).toBe(403);
  41 |   await post(reviewer.request,'/api/applications',{action:'review',id:current.id,version:current.version,decision:'changes',note:'Please clarify the parking address.'});current=await app();
  42 |   await post(page.request,'/api/applications',{action:'save',id:current.id,version:current.version,fields:{...current.fields,parkingAddress:'Updated test parking address, Rajkot city',declarationAccepted:true},step:5});current=await app();
  43 |   expect((await reviewer.request.get('/api/applications').then(r=>r.json())).applications.find((a:{id:string})=>a.id===current.id).fields.parkingAddress).toBe(fields.parkingAddress);
  44 |   await post(page.request,'/api/applications',{action:'submit',id:current.id,version:current.version});current=await app();
  45 |   await post(reviewer.request,'/api/applications',{action:'review',id:current.id,version:current.version,decision:'approve',note:'Test package reviewed independently.',checks:{identity:true,ownership:true,documents:true,jurisdiction:true}});current=await app();expect(current.status).toBe('Approved');expect(current.vehicleId).toBeTruthy();expect(current.revisions).toHaveLength(2);
  46 |   expect((await reviewer.request.post('/api/applications',{headers:{Origin:origin},data:{action:'verify-installation',id:current.id,version:current.version,note:'Physical mounting and seal checked.'}})).status()).toBe(400);
  47 |   const body=JSON.stringify({deviceId,timestamp:Date.now(),nonce:randomUUID()});expect((await page.request.post('/api/devices/heartbeat',{data:body,headers:{'Content-Type':'application/json','x-vahakin-signature':'0'.repeat(64)}})).status()).toBe(401);
  48 |   const headers={'Content-Type':'application/json','x-vahakin-signature':createHmac('sha256',secret).update(body).digest('hex')};expect((await page.request.post('/api/devices/heartbeat',{data:body,headers})).status()).toBe(200);expect((await page.request.post('/api/devices/heartbeat',{data:body,headers})).status()).toBe(409);
  49 |   current=await app();await post(reviewer.request,'/api/applications',{action:'verify-installation',id:current.id,version:current.version,note:'Physical mounting and seal checked.'});
  50 |   await page.goto('/owner/vehicles');await expect(page.getByText(fields.registration,{exact:true}).first()).toBeVisible();await expect(page.getByText('MOCK',{exact:true})).toHaveCount(0);expect((await db.from('ig_vehicles').select('payload').eq('id',current.vehicleId).single()).data?.payload.source).toBe('MANUAL');
  51 |   await page.request.delete('/api/session',{headers:{Origin:origin}});await page.goto('/login/owner');await page.getByLabel('Email address',{exact:true}).fill(emails[0]);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in to your workspace'}).click();await page.waitForURL('**/owner');await page.screenshot({path:'/tmp/vahakin-live-owner.png',fullPage:true});expect(errors).toEqual([]);
  52 |   expect((await db.from('ig_staff_grants').select('role,office').eq('email','rashiyaom@gmail.com').single()).data).toEqual({role:'rto_admin',office:'GJ-03'});
  53 |  }finally{
  54 |   const apps=await db.from('ig_applications').select('id').in('owner_id',users);const docs=await db.from('ig_documents').select('payload').in('application_id',(apps.data??[]).map(a=>a.id));const paths=(docs.data??[]).map(d=>d.payload.storagePath).filter(Boolean);if(paths.length)expect((await db.storage.from('vahakin-documents').remove(paths)).error).toBeNull();
  55 |   for(const table of ['ig_device_nonces','ig_device_credentials'])await db.from(table).delete().eq('device_id',deviceId);await db.from('ig_devices').delete().eq('id',deviceId);await db.from('ig_work_items').delete().in('actor_id',users);await db.from('ig_vehicles').delete().in('owner_id',users);for(const id of users)expect((await db.auth.admin.deleteUser(id)).error).toBeNull();await reviewer.close();await other.close();
  56 |  }
  57 | });
  58 | 
```