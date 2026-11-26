import { accountStore, accountTransaction } from "@/lib/server/live-store";
import { adminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomUUID, createHash } from "node:crypto";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import path from "node:path";
import { currentAccount, sameOrigin } from "@/lib/server/session";
import { applicationView, editableApplication, EnrollmentError, touch } from "@/lib/server/enrollment";
import { appendAudit } from "@/lib/server/demo-store";
import { documentLabels } from "@/lib/enrollment/policy";
import type { DocumentKind } from "@/lib/enrollment/types";
import { MAX_DOCUMENT_BYTES, uploadDirectory, validateUpload } from "@/lib/server/enrollment-files";
import { boundedBody, enrollmentFailure } from "@/lib/server/enrollment-http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Please sign in to upload." }, { status: 401 });
  let storedPath: string | null = null;
  let committed = false;
  let storagePath: string | null = null;
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.startsWith("multipart/form-data;")) throw new EnrollmentError("Choose a file to upload.");
    const body = await boundedBody(request, MAX_DOCUMENT_BYTES + 16384);
    const form = await new Response(new Uint8Array(body), { headers: { "Content-Type": contentType } }).formData();
    const id = String(form.get("id") ?? ""), version = Number(form.get("version")), kind = String(form.get("kind")) as DocumentKind;
    if (!Object.hasOwn(documentLabels, kind)) throw new EnrollmentError("Choose a document category.");
    const file = form.get("file");
    if (!(file instanceof File)) throw new EnrollmentError("Choose a file to upload.");
    const bytes = Buffer.from(await file.arrayBuffer()); const mime = validateUpload(bytes, file.name, file.type, kind);
    const documentId = randomUUID();
    // Validate ownership and version before sending any bytes to private storage.
    editableApplication(await accountStore(account), account, id, version);
    if (account.mode === "live") {
      storagePath = `${account.id}/${id}/${documentId}`;
      const { error } = await adminClient().storage.from("vahakin-documents").upload(storagePath, bytes, { contentType: mime, upsert: false });
      if (error) throw new EnrollmentError("Unable to upload this document. Please retry.", 503);
    }
    await accountTransaction(account, store => {
      const app = editableApplication(store, account, id, version);
      if (app.documents.length >= 32) throw new EnrollmentError("The replacement limit has been reached. Contact the office for help.");
      if (account.mode !== "live") {
      mkdirSync(uploadDirectory, { recursive: true, mode: 0o700 });
      storedPath = path.join(uploadDirectory, documentId);
      writeFileSync(storedPath, bytes, { flag: "wx", mode: 0o600 });
      }
      const now = new Date().toISOString();
      for (const doc of app.documents) if (doc.kind === kind && !doc.removedAt) doc.removedAt = now;
      app.documents.push({ id: documentId, kind, name: file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120), mime, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), uploadedAt: now, removedAt: null, ...(storagePath ? { storagePath } : {}) });
      app.fields.declarationAccepted = false;
      appendAudit(store, account, "Application document uploaded", app.id, `${kind} · ${documentId}`);
      touch(app);
    });
    committed = true;
    return NextResponse.json(applicationView(await accountStore(account), account), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (storagePath && !committed) await adminClient().storage.from("vahakin-documents").remove([storagePath]);
    if (storedPath && !committed) { try { unlinkSync(storedPath); } catch { /* No private orphan should block the error response. */ } }
    return enrollmentFailure(e);
  }
}
