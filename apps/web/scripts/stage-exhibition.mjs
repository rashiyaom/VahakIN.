import {createClient} from '@supabase/supabase-js';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
function checked(r){if(r.error)throw Error(r.error.message);return r.data;}
await mkdir('.provisioned',{recursive:true,mode:0o700});
checked(await c.from('ig_offices').upsert({code:'GJ-21',name:'Gandhinagar RTO',state:'Gujarat',district:'Gandhinagar',service_area:'Gandhinagar district',accepting_applications:true}));
checked(await c.from('ig_staff_grants').upsert({email:'rashiyaom@gmail.com',role:'rto_admin',state:'Gujarat',office:'GJ-21'}));
let staff=checked(await c.from('ig_profiles').select('*').eq('email','rashiyaom@gmail.com').maybeSingle());
let password;
try{password=JSON.parse(await readFile('.provisioned/exhibition-login.json','utf8')).password;}catch{password='Vh!'+randomBytes(15).toString('base64url');}
if(!staff){const u=checked(await c.auth.admin.createUser({email:'rashiyaom@gmail.com',password,email_confirm:true,user_metadata:{full_name:'Rashi Yaom'}}));staff={id:u.user.id};}
else checked(await c.auth.admin.updateUserById(staff.id,{password}));
await writeFile('.provisioned/exhibition-login.json',JSON.stringify({email:'rashiyaom@gmail.com',password},null,2),{mode:0o600});
checked(await c.from('ig_profiles').update({role:'rto_admin',state:'Gujarat',office:'GJ-21'}).eq('id',staff.id));
const owner=checked(await c.from('ig_profiles').select('*').eq('email','devanshi1712p@gmail.com').single());
const snapshot=checked(await c.rpc('ig_read_workspace',{p_actor:owner.id}));
let app=snapshot.applications.find(a=>!['Approved','Rejected'].includes(a.status));
if(app?.status==='Submitted'&&app.fields.reasonDetails.includes('EXHIBITION DEMO')){console.log('Demonstration application already submitted.');process.exit(0);}
if(!app||app.status!=='Draft'||app.fields.registration)throw Error('Refusing to replace an existing completed application.');
const device=checked(await c.from('ig_devices').select('payload').eq('id','IG-PLUS-0001').single()).payload;
if(device.assignedVehicleId||device.reservedBy&&device.reservedBy!==owner.id)throw Error('Plus device already assigned.');
const now=new Date().toISOString();
app={...app,status:'Submitted',step:5,version:app.version+1,office:'GJ-21',deviceId:device.id,deviceTier:'PLUS',submittedAt:now,updatedAt:now,fields:{...app.fields,fullName:'Devanshi Patel',registeredOwner:'Devanshi Patel',mobile:'9000000000',address:'EXHIBITION DEMO - Mahatma Mandir, Gandhinagar',ownerPincode:'382016',registration:'GJ21DE2026',category:'Private vehicle',model:'EXHIBITION DEMO vehicle',chassis:'DEMOONLY2026',fuel:'Petrol',year:'2024',taxReference:'DEMO-TAX-2026',taxAuthority:'Gandhinagar RTO - exhibition sample',taxPaidThrough:'2027-03-31',startsOn:'2026-11-28',endsOn:'2026-12-28',reason:'Planned non-use',reasonDetails:'EXHIBITION DEMO: staged with sample documents at the project owner request; not real regulatory evidence.',parkingAddress:'EXHIBITION DEMO - Mahatma Mandir, Gate 7 auditorium, Gandhinagar',parkingPincode:'382016',district:'Gandhinagar',area:'Gandhinagar city',latitude:'23.23127',longitude:'72.63359',declarationAccepted:true}};
function pdf(title){const lines=['EXHIBITION DEMO - NOT A VALID DOCUMENT',title,'Devanshi Patel - GJ21DE2026','Sample prepared for VahakIN approval workflow.','Not issued or signed by a government authority.'];const stream='BT /F1 16 Tf 45 760 Td '+lines.map((s,i)=>(i?'0 -35 Td ':'')+'('+s+') Tj').join('\n')+' ET';const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];let s='%PDF-1.4\n',offsets=[0];objs.forEach((o,i)=>{offsets.push(Buffer.byteLength(s));s+=`${i+1} 0 obj\n${o}\nendobj\n`;});const x=Buffer.byteLength(s);s+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;return Buffer.from(s);}
const docs=[];
for(const [kind,title] of [['rc','Registration certificate sample'],['tax','Tax receipt sample'],['nonuse','Non-use declaration sample']]){const id=randomUUID(),bytes=pdf(title),storagePath=`${owner.id}/${app.id}/${id}`;checked(await c.storage.from('vahakin-documents').upload(storagePath,bytes,{contentType:'application/pdf'}));docs.push({id,kind,name:`DEMO-${kind}.pdf`,mime:'application/pdf',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),uploadedAt:now,removedAt:null,storagePath});}
const history={id:randomUUID(),at:now,actorId:staff.id,actorName:'Exhibition setup',action:'Submitted demonstration case',note:'Project owner requested a staged application. All attached evidence is marked DEMO; Devanshi did not perform this submission.'};
const revision={number:1,submittedAt:now,fields:app.fields,documentIds:docs.map(d=>d.id),deviceId:device.id,office:'GJ-21',policyVersion:'GJ-EXHIBITION-2026-11-27'};
const changes=[{kind:'applications',id:app.id,payload:app},{kind:'devices',id:device.id,payload:{...device,reservedBy:owner.id,applicationId:app.id}},...docs.map(d=>({kind:'documents',id:d.id,applicationId:app.id,payload:d})),{kind:'revisions',id:app.id+':1',applicationId:app.id,payload:revision},{kind:'history',id:history.id,applicationId:app.id,payload:history}];
checked(await c.rpc('ig_commit_workspace',{p_actor:owner.id,p_expected:snapshot.version,p_changes:changes}));
const queue=checked(await c.rpc('ig_read_workspace',{p_actor:staff.id}));if(!queue.applications.some(a=>a.id===app.id&&a.status==='Submitted'))throw Error('Queue verification failed');
console.log(JSON.stringify({governmentAccount:'rashiyaom@gmail.com',office:'GJ-21',applicationId:app.id,status:'Submitted',documents:docs.length,queueVerified:true,credentialsFile:'.provisioned/exhibition-login.json'}));
