import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/server";
import { boundedBody, enrollmentFailure } from "@/lib/server/enrollment-http";
import { EnrollmentError } from "@/lib/server/enrollment";
import { limitAttempts } from "@/lib/server/live-store";
import { hardwareSchema, validHardwareSignature, applyHardwareReading } from "@/lib/server/hardware";
import { watchView } from "@/lib/server/watch-view";
export const runtime="nodejs";
export async function POST(request:Request) {
  try {
    const bytes=await boundedBody(request,4096);
    let raw; try { raw=JSON.parse(bytes.toString("utf8")); } catch { throw new EnrollmentError("Invalid telemetry JSON."); }
    const result=hardwareSchema.safeParse(raw);
    if (!result.success) throw new EnrollmentError("Invalid hardware telemetry.");
    const message=result.data, client=adminClient();
    const {data:credential,error}=await client.from("ig_device_credentials").select("secret").eq("device_id",message.deviceId).maybeSingle();
    if (error || !credential || !validHardwareSignature(bytes,request.headers.get("x-vahakin-signature")??"",credential.secret,message.timestamp)) throw new EnrollmentError("Device authentication failed.",401);
    if (!await limitAttempts(`telemetry:${message.deviceId}`,240,900)) throw new EnrollmentError("Telemetry rate exceeded. Retry later.",429);
    for(let attempt=0;attempt<4;attempt++) {
      const snapshot=await client.rpc("ig_hardware_snapshot",{p_device:message.deviceId});
      if(snapshot.error || !snapshot.data) throw new EnrollmentError("Device storage unavailable.",503);
      const s=snapshot.data;
      const plus=s.device.tier==="PLUS";
      if (plus !== (message.firmware==="plus-watch-1.0.0") || (plus && message.gps!==null)) throw new EnrollmentError("Firmware capabilities do not match the provisioned device.",409);
      const alerts=s.vehicle && s.application ? applyHardwareReading(s.vehicle,s.application,message) : [];
      const committed=await client.rpc("ig_commit_hardware",{p_expected:s.version,p_device:message.deviceId,p_nonce:message.nonce,p_event:message,p_vehicle:s.vehicle??null,p_alerts:alerts});
      if(committed.error?.code==="40001") continue;
      if(committed.error) throw new EnrollmentError(committed.error.code==="23505"?"Event identity conflict.":"Telemetry could not be recorded.",committed.error.code==="23505"?409:503);
      return NextResponse.json({receivedAt:committed.data,deviceId:message.deviceId,nonce:message.nonce,watch:plus?watchView(s.vehicle):null},{headers:{"Cache-Control":"no-store"}});
    }
    throw new EnrollmentError("Workspace busy. Retry the same packet.",503);
  } catch(error) { return enrollmentFailure(error); }
}
