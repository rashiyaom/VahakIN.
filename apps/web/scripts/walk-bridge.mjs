// Persistent local worker. Run from apps/web with: node --env-file=.env.local scripts/walk-bridge.mjs
import makeWASocket,{useMultiFileAuthState,DisconnectReason,jidNormalizedUser} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import {createClient} from '@supabase/supabase-js';
import {mkdirSync,readFileSync,writeFileSync,renameSync,existsSync,unlinkSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {initialState,advance} from '../lib/walk/engine.ts';
const dir=path.resolve('.provisioned/walk');mkdirSync(dir,{recursive:true,mode:0o700});
const lock=path.join(dir,'worker.pid');if(existsSync(lock)){const old=Number(readFileSync(lock,'utf8'));try{process.kill(old,0);throw new Error('A walk worker is already running');}catch(e){if(e.code!=='ESRCH')throw e;}}
writeFileSync(lock,String(process.pid),{mode:0o600});process.on('exit',()=>{try{unlinkSync(lock);}catch{}});process.on('SIGTERM',()=>process.exit());process.on('SIGINT',()=>process.exit());
const read=name=>{try{return JSON.parse(readFileSync(path.join(dir,name+'.json'),'utf8'));}catch{return null;}};
const save=(name,data)=>{const dest=path.join(dir,name+'.json'),tmp=dest+'.'+randomUUID();writeFileSync(tmp,JSON.stringify(data),{mode:0o600});renameSync(tmp,dest);};
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const logger=pino({level:'silent'});let socket,connected=false,reconnectTimer;let bridge={connected:false,at:Date.now()};
async function connect(){
 const {state,saveCreds}=await useMultiFileAuthState(path.join(dir,'auth'));
 socket=makeWASocket({auth:state,logger,markOnlineOnConnect:false,syncFullHistory:false,shouldSyncHistoryMessage:()=>false});
 socket.ev.on('creds.update',saveCreds);
 socket.ev.on('connection.update',async({connection,qr,lastDisconnect})=>{
  if(qr){bridge={connected:false,qr:await QRCode.toDataURL(qr),at:Date.now()};save('bridge',bridge);console.log('WhatsApp QR ready in the RTO live demonstration page.');}
  if(connection==='open'){
   const expected=read('settings')?.sender;const actual=jidNormalizedUser(socket.user?.id??'').split('@')[0];
   if(!expected||actual!==expected){connected=false;bridge={connected:false,error:'Wrong sender linked. Use the configured WhatsApp account.',at:Date.now()};save('bridge',bridge);socket.end(new Error('Wrong sender'));return;}
   connected=true;bridge={connected:true,at:Date.now()};save('bridge',bridge);console.log('Configured WhatsApp sender connected.');
  }
  if(connection==='close'){connected=false;const loggedOut=lastDisconnect?.error?.output?.statusCode===DisconnectReason.loggedOut;bridge={connected:false,at:Date.now(),error:loggedOut?'WhatsApp logged out. Relink this sender.':'WhatsApp reconnecting'};save('bridge',bridge);if(!loggedOut){clearTimeout(reconnectTimer);reconnectTimer=setTimeout(()=>connect().catch(()=>{}),5000);}}
 });
}
await connect();
async function tick(){
 bridge.at=Date.now();save('bridge',bridge);
 const manual=read('manual-message'),settings=read('settings');
 if(manual&&!manual.sent&&connected&&manual.recipient===settings?.recipient&&Date.now()-manual.createdAt<300000){
  const result=await socket.sendMessage(manual.recipient+'@s.whatsapp.net',{text:manual.text},{messageId:manual.id});
  manual.sent=true;manual.sentAt=Date.now();manual.messageId=result?.key?.id;save('manual-message',manual);
 }
 const c=read('config');if(!c?.enabled||c.expiresAt<Date.now())return;
 const {data,error}=await db.from('ig_vehicles').select('payload,owner_id,office').eq('id',c.vehicleId).single();
 if(error)throw new Error('Vehicle lookup failed');
 if(data.owner_id!==c.ownerId||data.office!==c.office||data.payload.deviceId!=='IG-PLUS-0001')throw new Error('Vehicle assignment changed; stop and reconfigure');
 let s=read('state');if(s?.session!==c.session)s=initialState(c);
 advance(s,c,data.payload,Date.now());save('state',s);
 for(const event of s.events){
  if(!event.db){const alert={id:event.id,vehicleId:c.vehicleId,title:`Walking POC · ${event.kind}`,description:event.text,severity:['exit','deadline','movement'].includes(event.kind)?'High':'Low',status:'New',occurredAt:new Date(event.at).toISOString(),receivedAt:new Date().toISOString(),evidence:[event.id],assignee:null,acknowledgedAt:null};
   const r=await db.from('ig_work_items').upsert({id:event.id,kind:'alerts',payload:alert,office:c.office,vehicle_id:c.vehicleId,actor_id:c.ownerId},{onConflict:'id',ignoreDuplicates:true});if(r.error)throw new Error('RTO alert write failed');event.db=true;save('state',s);
  }
  if(!event.sent&&connected&&(event.nextAttempt??0)<=Date.now()){
   try{
    const text=`VahakIN POC · ${c.registration}\n${event.text}\nLive phone location: ${c.origin}/track#${c.token}\nExpires in 4 hours; phone must remain beside the watch. Demo assessment only.`;
    await socket.sendMessage(c.recipient+'@s.whatsapp.net',{text},{messageId:event.id.replaceAll('-','').slice(-40)});event.sent=true;delete event.nextAttempt;save('state',s);
   }catch{event.attempts=(event.attempts??0)+1;event.nextAttempt=Date.now()+Math.min(60000,2000*2**Math.min(5,event.attempts));save('state',s);}
  }
 }
}
for(;;){try{await tick();}catch(e){bridge.error=e.message;save('bridge',bridge);}await new Promise(r=>setTimeout(r,2000));}
