import { NextResponse } from "next/server";
import { EnrollmentError } from "./enrollment";
export function enrollmentFailure(error: unknown) {
  return NextResponse.json({ error: error instanceof EnrollmentError ? error.message : "Unable to save right now. Your last saved draft is safe. Please retry.", fields: error instanceof EnrollmentError ? error.fields : {} }, { status: error instanceof EnrollmentError ? error.status : 500 });
}
export async function boundedBody(request: Request, max: number): Promise<Buffer> {
  if (Number(request.headers.get("content-length")) > max) throw new EnrollmentError("This upload is too large.", 413);
  if (!request.body) throw new EnrollmentError("Request body is missing.");
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > max) { await reader.cancel(); throw new EnrollmentError("This upload is too large.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
