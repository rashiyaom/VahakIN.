import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { adminClient } from "@/lib/supabase/server";
import { boundedBody, enrollmentFailure } from "@/lib/server/enrollment-http";
import { limitAttempts } from "@/lib/server/live-store";
import { EnrollmentError } from "@/lib/server/enrollment";
export const runtime = "nodejs";
const schema = z.object({ deviceId: z.string().regex(/^IG-[A-Z0-9-]{4,80}$/), timestamp: z.number().int(), nonce: z.string().uuid() }).strict();
export async function POST(request: Request) {
  try {
    const bytes = await boundedBody(request, 1024);
    const parsed = schema.safeParse(JSON.parse(bytes.toString("utf8")));
    if (!parsed.success) throw new EnrollmentError("Invalid device message.");
    const { deviceId, timestamp, nonce } = parsed.data;
    const signature = request.headers.get("x-vahakin-signature") ?? "";
    if (!/^[a-f0-9]{64}$/.test(signature) || Math.abs(Date.now() - timestamp) > 300000) throw new EnrollmentError("Device authentication failed.", 401);
    const client = adminClient();
    const { data, error } = await client.from("ig_device_credentials").select("secret").eq("device_id", deviceId).maybeSingle();
    if (error || !data || !timingSafeEqual(Buffer.from(signature, "hex"), createHmac("sha256", data.secret).update(bytes).digest())) throw new EnrollmentError("Device authentication failed.", 401);
    if (!await limitAttempts(`heartbeat:${deviceId}`, 120, 900)) throw new EnrollmentError("Send heartbeats no more often than every 15 seconds.", 429);
    const result = await client.rpc("ig_record_heartbeat", { p_device: deviceId, p_nonce: nonce });
    if (result.error) throw new EnrollmentError(result.error.code === "23505" ? "Heartbeat already received." : "Connection could not be recorded.", result.error.code === "23505" ? 409 : 503);
    return NextResponse.json({ receivedAt: result.data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return enrollmentFailure(error); }
}
