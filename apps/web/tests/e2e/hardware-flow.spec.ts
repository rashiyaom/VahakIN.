import { test, expect } from '@playwright/test';
import { authenticateDemo } from './demo-auth';
const origin=process.env.VAHAKIN_TEST_URL||'http://localhost:3000';
const future=(days:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+days*86400000));
test('pending owners can navigate without a redirect loop; RTO sees photo previews and edits geofences',async({page,browser})=>{
 test.setTimeout(120000);
 await authenticateDemo(page.request);
 const post=async(request:typeof page.request,url:string,data:unknown)=>{const r=await request.post(url,{headers:{Origin:origin},data});expect(r.status(),await r.text()).toBe(200);return r.json();};
 await post(page.request,'/api/session',{mode:'new-owner'});
 await page.goto('/owner');await expect(page.getByRole('link',{name:'Continue vehicle setup'})).toBeVisible();
 for(const route of ['vehicles','monitoring','alerts','requests','applications']){await page.goto(`/owner/${route}`);await expect(page).toHaveURL(new RegExp(`/owner/${route}`));}
 const data=await page.request.get('/api/applications').then(r=>r.json());let app=data.applications[0];
 app=(await post(page.request,'/api/applications',{action:'claim',id:app.id,version:app.version,deviceId:data.demoKit.id,code:data.demoKit.code})).applications[0];
 const registration=`GJ03H${String(Date.now()).slice(-4)}`;
 app=(await post(page.request,'/api/applications',{action:'save',id:app.id,version:app.version,step:4,fields:{...app.fields,fullName:'Photo Preview Demo',mobile:'9876543210',address:'Sample address in Rajkot city',ownerPincode:'360001',registration,model:'Sample car',category:'Private vehicle',chassis:'DEMOCHASSIS98765',year:'2024',taxReference:'DEMO-TAX-001',taxAuthority:'Rajkot RTO',taxPaidThrough:future(90),startsOn:future(2),endsOn:future(10),reasonDetails:'Planned maintenance in demonstration garage',parkingAddress:'Sample plot 12 in Rajkot city',parkingPincode:'360001',area:'Rajkot city',declarationAccepted:true}})).applications[0];
 const base64=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=800;canvas.height=400;const c=canvas.getContext('2d')!;c.fillStyle='#f5f2e9';c.fillRect(0,0,800,400);c.fillStyle='#164a45';c.font='bold 36px sans-serif';c.fillText('DEMO DOCUMENT',45,85);c.font='24px sans-serif';c.fillText('Fictional test evidence — no personal data',45,155);c.fillText('Clear image preview for the RTO reviewer',45,225);return canvas.toDataURL('image/png').split(',')[1];});
 for(const kind of ['rc','tax','nonuse','photo']){
  const uploaded=await page.request.post('/api/applications/documents',{headers:{Origin:origin},multipart:{id:app.id,version:String(app.version),kind,file:{name:'demo-document.png',mimeType:'image/png',buffer:Buffer.from(base64,'base64')}}});expect(uploaded.status(),await uploaded.text()).toBe(200);app=(await uploaded.json()).applications[0];
 }
 app=(await post(page.request,'/api/applications',{action:'save',id:app.id,version:app.version,fields:{...app.fields,declarationAccepted:true},step:5})).applications[0];
 await post(page.request,'/api/applications',{action:'submit',id:app.id,version:app.version});
 const context=await browser.newContext({baseURL:origin});const rto=await context.newPage();
 await authenticateDemo(rto.request);await post(rto.request,'/api/session',{mode:'demo',accountId:'demo-rto'});
 await rto.goto('/gov/applications');await rto.getByRole('button',{name:new RegExp(registration)}).click();
 const images=rto.locator('.enrol-document-package img');await expect(images).toHaveCount(4);
 await expect.poll(()=>images.evaluateAll(elements=>elements.every(e=>(e as HTMLImageElement).complete&&(e as HTMLImageElement).naturalWidth===800))).toBe(true);
 await images.first().scrollIntoViewIfNeeded();await rto.screenshot({path:'/tmp/vahakin-rto-photo-preview.png'});
 const preview=await rto.request.get(`/api/applications/documents/${app.documents[0].id}?preview=1`);expect(preview.headers()['content-disposition']).toContain('inline');expect(preview.headers()['cache-control']).toContain('no-store');
 await rto.goto('/gov/monitoring');const editor=rto.locator('section').filter({has:rto.getByRole('heading',{name:'Parking geofence',exact:true})}).last();
 await editor.getByLabel('Parking latitude').fill('22.3039');await editor.getByLabel('Parking longitude').fill('70.8022');await editor.getByLabel('Radius (metres)').fill('175');await editor.getByRole('button',{name:'Save geofence'}).click();await expect(editor.getByRole('status')).toContainText('Geofence saved');
 await rto.reload();await expect(rto.getByLabel('Radius (metres)')).toHaveValue('175');await rto.screenshot({path:'/tmp/vahakin-geofence-editor.png',fullPage:true});
 await context.close();
});
