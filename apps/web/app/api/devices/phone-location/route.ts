import { NextResponse } from "next/server";
import { currentAccount,sameOrigin } from "@/lib/server/session";
import { accountStore,accountTransaction,limitAttempts } from "@/lib/server/live-store";
import { adminClient } from "@/lib/supabase/server";
import { boundedBody,enrollmentFailure } from "@/lib/server/enrollment-http";
import { EnrollmentError } from "@/lib/server/enrollment";
import { applyPhoneLocation,phoneLocationSchema } from "@/lib/server/phone-location";
import type { DemoStore } from "@/lib/server/demo-store";
export const runtime="nodejs";
export async function POST(request:Request){
  try {
    if(!sameOrigin(request))throw new EnrollmentError("Invalid request origin.",403);
    const account=await currentAccount();
    if(!account)throw new EnrollmentError("Sign in as the vehicle owner.",401);
    if(account.role!=="vehicle_owner")throw new EnrollmentError("Only owners can share phone location.",403);
    const bytes=await boundedBody(request,2048);
    let raw;try{raw=JSON.parse(bytes.toString("utf8"));}catch{throw new EnrollmentError("Invalid location message.");}
    const parsed=phoneLocationSchema.safeParse(raw);if(!parsed.success)throw new EnrollmentError("Invalid phone location or consent.");
    const input=parsed.data;
    if(account.mode==="live"&&!await limitAttempts(`phone-location:${account.id}`,240,900))throw new EnrollmentError("Too many location updates. Wait before retrying.",429);
    const update=(store:DemoStore)=>{
      const vehicle=store.vehicles.find(v=>v.id===input.vehicleId&&v.ownerId===account.id);
      const app=store.enrollment?.applications.find(a=>a.vehicleId===vehicle?.id&&a.ownerId===account.id);
      if(!vehicle||!app)throw new EnrollmentError("Vehicle not found in your account.",404);
      const result=applyPhoneLocation(account,vehicle,app,input);
      return {vehicle,result};
    };
    if(account.mode!=="live"){
      const result=await accountTransaction(account,store=>{const {result}=update(store);for(const alert of result.alerts)if(!store.alerts.some(a=>a.vehicleId===alert.vehicleId&&a.title===alert.title&&a.status!=="Resolved"))store.alerts.push(alert);return result;});
      return NextResponse.json({sessionId:result.sessionId,status:result.status},{headers:{"Cache-Control":"no-store"}});
    }
    for(let attempt=0;attempt<4;attempt++){
      const store=await accountStore(account),{vehicle,result}=update(store);
      const {error}=await adminClient().rpc("ig_commit_phone_location",{p_actor:account.id,p_expected:store.version,p_vehicle:vehicle,p_event:input,p_alerts:result.alerts});
      if(error?.code==="40001")continue;
      if(error)throw new EnrollmentError(error.code==="23505"?"Location event identity conflict.":"Unable to save phone location.",error.code==="23505"?409:503);
      return NextResponse.json({sessionId:result.sessionId,status:result.status},{headers:{"Cache-Control":"no-store"}});
    }
    throw new EnrollmentError("Workspace busy. Please retry.",503);
  }catch(error){return enrollmentFailure(error);}
}
