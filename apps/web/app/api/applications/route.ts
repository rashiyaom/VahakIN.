import { accountStore, accountTransaction, limitAttempts } from "@/lib/server/live-store";
import { NextResponse } from "next/server";
import { currentAccount, sameOrigin } from "@/lib/server/session";
import { applicationView, confirmDashboardMounting, claimDevice, editableApplication, EnrollmentError, enrollmentState, reviewApplication, saveDraft, setupDemoDevice, startApplication, submitApplication, touch, verifyDemoInstallation } from "@/lib/server/enrollment";
import { boundedBody, enrollmentFailure } from "@/lib/server/enrollment-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  return NextResponse.json(applicationView(await accountStore(account), account), { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  try {
    const text = await boundedBody(request, 32768);
    let input; try { input = JSON.parse(text.toString()); } catch { throw new EnrollmentError("Invalid application request."); }
    if (!input || typeof input.action !== "string") throw new EnrollmentError("Choose an application action.");
    if (input.action !== "start" && (typeof input.id !== "string" || !Number.isInteger(input.version))) throw new EnrollmentError("Missing application ID or version.");
    if (input.action === "claim") {
      const allowed = account.mode === "live" ? await limitAttempts(`claim:${account.id}`) : await accountTransaction(account,store => {
        const attempts = enrollmentState(store).claimAttempts;
        if (!attempts[account.id] || attempts[account.id].until < Date.now()) attempts[account.id] = { count: 0, until: Date.now() + 15 * 60000 };
        attempts[account.id].count++;
        return attempts[account.id].count <= 10;
      });
      if (!allowed) throw new EnrollmentError("Too many activation attempts. Wait 15 minutes before trying again.", 429);
    }
    await accountTransaction(account,store => {
      switch (input.action) {
        case "start": startApplication(store, account); break;
        case "save": saveDraft(store, account, input.id, input.version, input.fields, input.step); break;
        case "claim":
          if (typeof input.deviceId !== "string" || typeof input.code !== "string" || input.deviceId.length > 100 || input.code.length > 100) throw new EnrollmentError("Enter the device ID and activation code.");
          claimDevice(store, account, input.id, input.version, input.deviceId, input.code); break;
        case "release": {
          const app = editableApplication(store, account, input.id, input.version);
          if (app.submittedAt) throw new EnrollmentError("Contact the office to change a device after submission.", 409);
          const device = enrollmentState(store).devices.find(d => d.id === app.deviceId && d.applicationId === app.id);
          if (device) { device.reservedBy = null; device.applicationId = null; device.lastSetupAt = null; }
          app.deviceId = null; app.deviceTier = undefined; touch(app); break;
        }
        case "remove-document": {
          const app = editableApplication(store, account, input.id, input.version);
          const doc = app.documents.find(d => d.id === input.documentId && !d.removedAt);
          if (!doc) throw new EnrollmentError("Document not found.", 404);
          doc.removedAt = new Date().toISOString(); app.fields.declarationAccepted = false; touch(app); break;
        }
        case "submit": submitApplication(store, account, input.id, input.version); break;
        case "review": reviewApplication(store, account, input.id, input.version, String(input.decision ?? ""), String(input.note ?? ""), input.checks); break;
        case "demo-setup": if(account.mode === "live") throw new EnrollmentError("Simulated setup is unavailable for live devices.",403); setupDemoDevice(store, account, input.id, input.version); break;
        case "confirm-mounting": confirmDashboardMounting(store, account, input.id, input.version); break;
        case "verify-installation":
        case "demo-install": if(input.action === "demo-install" && account.mode === "live") throw new EnrollmentError("Use verified installation for live devices.",403); verifyDemoInstallation(store, account, input.id, input.version, String(input.note ?? "")); break;
        default: throw new EnrollmentError("Unknown application action.");
      }
    }, {deviceId: input.action === "claim" && typeof input.deviceId === "string" ? input.deviceId.trim().toUpperCase() : undefined});
    return NextResponse.json(applicationView(await accountStore(account), account), { headers: { "Cache-Control": "no-store" } });
  } catch (e) { return enrollmentFailure(e); }
}

