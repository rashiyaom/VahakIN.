import type {DemoStore} from './demo-store';
/** One-time upgrade of fictional fixtures only; never used by the live store. */
export function seedOwnerDemonstration(store:DemoStore,now=Date.now()) {
 if(store.mode==='live'||store.ownerDemoVersion===1)return false;
 const owner=store.accounts.find(a=>a.id==='demo-owner');if(!owner)return false;
 for(let i=1;i<=8;i++){
  const v=store.vehicles.find(v=>v.id===`v-${String(i).padStart(3,'0')}`&&v.source==='MOCK');
  if(v){v.ownerId=owner.id;v.ownerName=owner.name;}
 }
 const statuses=['Submitted','Under review','Approved','Rejected'];
 statuses.forEach((status,i)=>{
  const vehicleId=i===2?'v-002':`v-${String(i+1).padStart(3,'0')}`;
  if(!store.vehicles.some(v=>v.id===vehicleId&&v.ownerId===owner.id))return;
  const id=`REQ-OWNER-DEMO-${i+1}`;if(store.requests.some(r=>r.id===id))return;
  store.requests.push({id,vehicleId,createdBy:owner.id,date:new Date(now).toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'}),startTime:'10:00',endTime:'12:00',purpose:['Scheduled service — awaiting review','Inspection — review in progress','Workshop visit — approved in demo','Relocation — rejected in demo; revised details required'][i],destination:'Fictional service centre, Rajkot',status,createdAt:new Date(now-i*60000).toISOString(),reviewedBy:i>0?'demo-rto':null,...(status==='Approved'?{authorization:{reference:'DEMO-PERMIT-001',validFrom:new Date(now-3600000).toISOString(),validTo:new Date(now+3600000).toISOString(),conditionsVerified:true,mode:'DEMO' as const}}:{})});
 });
 store.ownerDemoVersion=1;return true;
}
