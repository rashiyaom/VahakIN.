import {z} from 'zod';
import {adminClient} from '@/lib/supabase/server';
import {NextResponse} from 'next/server';
import {randomBytes,randomUUID} from 'node:crypto';
import {currentAccount,sameOrigin} from '@/lib/server/session';
import {accountStore,accountTransaction} from '@/lib/server/live-store';
import {can,inJurisdiction} from '@/lib/permissions/access';
import {readWalk,writeWalk,walkConfig,walkState} from '@/lib/server/walk-files';
import {appendAudit} from '@/lib/server/demo-store';
export const runtime='nodejs';export const dynamic='force-dynamic';
const ownerId='605568d3-69ed-494c-af8a-5fd76b3eaaa9';
async function access(){const a=await currentAccount();if(!a||a.mode!=='live'||![ownerId,'b3dd089c-6074-4e55-b8a2-9bb4a0016a2d'].includes(a.id)||!can(a,'locations.read'))return null;const store=await accountStore(a);const v=store.vehicles.find(v=>v.ownerId===ownerId&&v.deviceId==='IG-PLUS-0001'&&inJurisdiction(a,v));return {a,store,v};}
export async function GET(){try{const x=await access();if(!x)return NextResponse.json({error:'Sign in to the authorised account.'},{status:403});const admin=can(x.a,'geofences.manage');const c=walkConfig(),s=walkState(),bridge=readWalk<any>('bridge');const active=!!c&&!!x.v&&c.vehicleId===x.v.id;
 let lastPosition=null;
 if(x.v&&x.v.lat==null){const result=await adminClient().from('ig_phone_location_events').select('payload').eq('vehicle_id',x.v.id).order('received_at',{ascending:false}).limit(1);const p=result.data?.[0]?.payload;if(p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng))lastPosition={lat:p.lat,lng:p.lng,accuracy:p.accuracy,gpsAt:new Date(p.timestamp).toISOString()};}
 return NextResponse.json({lastPosition,vehicleId:x.v?.id??null,registration:x.v?.registration??null,signals:{watch:!!x.v?.eventAt&&Date.now()-Date.parse(x.v.eventAt)<15000,phone:!!x.v?.gpsAt&&Date.now()-Date.parse(x.v.gpsAt)<15000&&x.v.gpsStatus==='Phone-provided location'&&(x.v.phoneLocationSession?.expiresAt??0)>Date.now(),accuracy:x.v?.accuracy??null},ready:!!x.v,settings:active?{enabled:c!.enabled,radiusM:c!.radiusM,lat:c!.lat,lng:c!.lng,returnSeconds:c!.returnSeconds,parkSeconds:c!.parkSeconds,rate:c!.rate,expiresAt:c!.expiresAt}:null,state:active&&s&&s.session===c?.session?{...s,events:s.events.map(({id,kind,at,text,sent})=>({id,kind,at,text,sent}))}:null,bridge:bridge?{connected:bridge.connected,at:bridge.at,error:bridge.error,qr:admin?bridge.qr:undefined}:null,admin},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Unable to load walk setup.'},{status:503});}}
export async function POST(req:Request){try{
 if(!sameOrigin(req))return NextResponse.json({error:'Invalid origin.'},{status:403});const x=await access();if(!x?.v||!can(x.a,'geofences.manage'))return NextResponse.json({error:'RTO approval and a scoped Plus vehicle are required.'},{status:403});
 const raw=await req.text();if(raw.length>1024)return NextResponse.json({error:'Request too large.'},{status:413});const body=JSON.parse(raw);
 if(body.action==='stop'){const c=walkConfig();if(c?.vehicleId===x.v.id)writeWalk('config',{...c,enabled:false});return NextResponse.json({ok:true});}
 if(body.action!=='start')return NextResponse.json({error:'Unsupported action.'},{status:400});
 const parsed=z.object({radiusM:z.number().finite().min(50).max(5000),centre:z.enum(['phone','custom']),lat:z.number().finite().min(-85).max(85).optional(),lng:z.number().finite().min(-180).max(180).optional()}).safeParse({radiusM:body.radiusM??50,centre:body.centre??'phone',lat:body.lat,lng:body.lng});
 if(!parsed.success||(parsed.data.centre==='custom'&&(parsed.data.lat===undefined||parsed.data.lng===undefined)))return NextResponse.json({error:'Choose a valid centre and radius from 50 to 5000 metres.'},{status:400});
 const input=parsed.data;const v=x.v,now=Date.now();if(input.centre==='phone'&&(v.locationSource!=='PHONE_BROWSER'||v.gpsStatus!=='Phone-provided location'||!v.phoneLocationSession||v.phoneLocationSession.expiresAt<now||now-Date.parse(v.gpsAt??'')>15000||!v.gpsAt||v.accuracy===null||v.accuracy>15||v.lat===null||v.lng===null))return NextResponse.json({error:'Start phone sharing outdoors first. A current fix accurate to 15 m or better is needed.'},{status:409});
 const lat=input.centre==='custom'?input.lat!:v.lat!,lng=input.centre==='custom'?input.lng!:v.lng!,radiusM=input.radiusM;
 if(walkConfig()?.enabled&&walkConfig()?.expiresAt!>now)return NextResponse.json({error:'Stop the current walk before changing its reference position.'},{status:409});
 const privateSettings=readWalk<any>('settings');if(!privateSettings?.recipient||!privateSettings?.sender||!/^https:\/\//.test(privateSettings.origin??''))return NextResponse.json({error:'Configure WhatsApp numbers and the trusted HTTPS address first.'},{status:409});
 await accountTransaction(x.a,store=>{const vehicle=store.vehicles.find(a=>a.id===v.id)!;vehicle.geofenceConfig={enabled:true,lat,lng,radiusM,version:(vehicle.geofenceConfig?.version??0)+1,updatedAt:new Date(now).toISOString()};vehicle.fenceCandidate=undefined;vehicle.geofence='Unknown';appendAudit(store,x.a,'Walking POC geofence set',vehicle.id,`RTO configured ${radiusM} m radius using ${input.centre} centre; demonstration only.`);});
 writeWalk('config',{enabled:true,session:randomUUID(),vehicleId:v.id,ownerId:v.ownerId,office:v.office,registration:v.registration,recipient:privateSettings.recipient,sender:privateSettings.sender,origin:privateSettings.origin,token:randomBytes(32).toString('hex'),expiresAt:now+4*3600000,startedAt:now,radiusM,lat,lng,returnSeconds:180,parkSeconds:180,rate:12});return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'Unable to update walk setup. Please retry.'},{status:503});}}
