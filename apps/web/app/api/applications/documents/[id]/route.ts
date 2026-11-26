import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { currentAccount } from "@/lib/server/session";
import { accountStore } from "@/lib/server/live-store";
import { adminClient } from "@/lib/supabase/server";
import { applicationView } from "@/lib/server/enrollment";
import { uploadDirectory } from "@/lib/server/enrollment-files";
export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Please sign in to view this document." }, { status: 401 });
  const { id } = await params;
  const doc = applicationView(await accountStore(account), account).applications.flatMap(a => a.documents).find(d => d.id === id);
  if (!doc || !/^[a-f0-9-]{36}$/.test(id)) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  try {
    let bytes: Uint8Array;
    if (account.mode === "live") {
      if (!doc.storagePath) throw new Error("Missing storage object");
      const { data, error } = await adminClient().storage.from("vahakin-documents").download(doc.storagePath);
      if (error || !data) throw new Error("Unavailable storage object");
      bytes = new Uint8Array(await data.arrayBuffer());
    } else bytes = new Uint8Array(readFileSync(path.join(uploadDirectory, id)));
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": doc.mime, "Content-Disposition": `${new URL(_request.url).searchParams.get("preview") === "1" ? "inline" : "attachment"}; filename="${doc.name.replace(/["\\\r\n]/g, "_")}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch { return NextResponse.json({ error: "This file is temporarily unavailable. Contact the office." }, { status: 404 }); }
}
