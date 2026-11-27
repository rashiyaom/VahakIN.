import {NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {walkConfig,walkState} from '@/lib/server/walk-files';
import {adminClient} from '@/lib/supabase/server';
export const runtime='nodejs';export const dynamic='force-dynamic';
export async function GET(req:Request){
 const token=req.headers.get('authorization')?.replace(/^Bearer /,''),c=walkConfig();
 if(!token||!c?.enabled||c.expiresAt<Date.now()||token.length!==c.token.length||!timingSafeEqual(Buffer.from(token),Buffer.from(c.token)))return NextResponse.json({error:'Tracking link expired or unavailable.'},{status:403});
 const {data,error}=await adminClient().from('ig_vehicles').select('payload,owner_id').eq('id',c.vehicleId).single();if(error||!data||data.owner_id!==c.ownerId)return NextResponse.json({error:'Vehicle unavailable.'},{status:404});
 const v=data.payload,s=walkState(),at=Date.parse(v.gpsAt??'');const fresh=v.locationSource==='PHONE_BROWSER'&&v.gpsStatus==='Phone-provided location'&&v.phoneLocationSession?.expiresAt>Date.now()&&Date.now()-at<=15000&&v.accuracy<=20;
 return NextResponse.json({registration:c.registration,location:fresh?{lat:v.lat,lng:v.lng,accuracy:v.accuracy,at:v.gpsAt}:null,fence:{lat:c.lat,lng:c.lng,radiusM:c.radiusM},phase:s?.session===c.session?s.phase:'waiting',deadline:s?.session===c.session?s.deadline:null,estimate:s?.session===c.session?s.estimate:0},{headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
}
