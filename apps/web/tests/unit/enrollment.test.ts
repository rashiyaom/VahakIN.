import { describe, expect, it } from "vitest";
import { applicationView, claimDevice, createApplicant, demoActivationCode, editableApplication, enrollmentState, getApplication, reviewApplication, saveDraft, setupDemoDevice, submitApplication, verifyDemoInstallation } from "../../lib/server/enrollment";
import { demoAccounts, type DemoStore } from "../../lib/server/demo-store";
import { emptyFields, type EnrollmentDocument, type EnrollmentFields } from "../../lib/enrollment/types";
import { requiredDocuments, routeOffice, indiaToday, reviewFlags } from "../../lib/enrollment/policy";
import { validateFields } from "../../lib/enrollment/validation";
import { validateUpload } from "../../lib/server/enrollment-files";

const future = (days: number) => indiaToday(new Date(Date.now() + days * 86400000));
const fields = (): EnrollmentFields => ({ ...emptyFields, fullName: "Fictional Sample Owner", mobile: "9876543210", address: "Sample address, Rajkot city", ownerPincode: "360001", registration: "GJ03ZZ9876", model: "Demo goods vehicle", chassis: "DEMOCHASSIS12345", year: "2024", taxReference: "DEMO-TAX-01", taxAuthority: "Rajkot", taxPaidThrough: future(90), startsOn: future(2), endsOn: future(20), reasonDetails: "Scheduled maintenance in the fictional depot", parkingAddress: "Sample workshop, Rajkot city", parkingPincode: "360001", area: "Rajkot city", declarationAccepted: true });
function fixture() {
  const store: DemoStore = { version: 1, accounts: structuredClone(demoAccounts), vehicles: [], alerts: [], cases: [], requests: [], audit: [], sessions: [], maintenance: [] };
  const owner = createApplicant(store), other = createApplicant(store), reviewer = store.accounts.find(a => a.id === "demo-rto")!;
  const app = enrollmentState(store).applications.find(a => a.ownerId === owner.id)!;
  claimDevice(store, owner, app.id, app.version, owner.demoDeviceId!, demoActivationCode(owner.demoDeviceId!));
  saveDraft(store, owner, app.id, app.version, fields(), 5);
  app.documents = requiredDocuments(app.fields).map(kind => ({ id: `doc-${kind}`, kind, name: "sample.pdf", mime: "application/pdf", size: 100, sha256: "example", uploadedAt: new Date().toISOString(), removedAt: null } satisfies EnrollmentDocument));
  return { store, owner, other, reviewer, app };
}
const checks = { identity: true, ownership: true, documents: true, jurisdiction: true };

describe("owner application lifecycle", () => {
  it("keeps pending applications outside the verified registry and publishes one immutable revision", () => {
    const { store, owner, reviewer, app } = fixture();
    expect(applicationView(store, reviewer).applications).toHaveLength(0);
    submitApplication(store, owner, app.id, app.version);
    expect(store.vehicles).toHaveLength(0);
    expect(applicationView(store, reviewer).applications[0].id).toBe(app.id);
    submitApplication(store, owner, app.id, app.version - 1);
    expect(app.revisions).toHaveLength(1);
    expect(app.office).toBe("GJ-03");
    expect(() => editableApplication(store, owner, app.id, app.version)).toThrow("locked");
  });
  it("enforces owner isolation, office scope and independent review", () => {
    const { store, owner, other, reviewer, app } = fixture();
    expect(() => getApplication(store, other, app.id)).toThrow("not found");
    submitApplication(store, owner, app.id, app.version);
    expect(applicationView(store, { ...reviewer, office: "GJ-01" }).applications).toHaveLength(0);
    expect(() => reviewApplication(store, owner, app.id, app.version, "approve", "Attempting self approval", checks)).toThrow("independent");
    expect(applicationView(store, store.accounts.find(a => a.id === "demo-technical")!).applications).toHaveLength(0);
    expect(applicationView(store, owner).devices[0]).not.toHaveProperty("claimHash");
  });
  it("keeps submitted evidence unchanged while the owner corrects a draft", () => {
    const { store, owner, reviewer, app } = fixture();
    submitApplication(store, owner, app.id, app.version);
    reviewApplication(store, reviewer, app.id, app.version, "changes", "Please correct the postal address.");
    saveDraft(store, owner, app.id, app.version, { ...app.fields, address: "Corrected sample address, Rajkot" }, 1);
    expect(app.revisions[0].fields.address).toBe("Sample address, Rajkot city");
    expect(applicationView(store, reviewer).applications[0].fields.address).toBe("Sample address, Rajkot city");
    submitApplication(store, owner, app.id, app.version);
    expect(app.revisions).toHaveLength(2);
    expect(applicationView(store, reviewer).applications[0].fields.address).toContain("Corrected");
  });
  it("requires checks before approval, creates one linked registry record, and keeps monitoring pending", () => {
    const { store, owner, reviewer, app } = fixture();
    submitApplication(store, owner, app.id, app.version);
    expect(() => reviewApplication(store, reviewer, app.id, app.version, "approve", "Documents checked and accepted.", {})).toThrow("Confirm identity");
    reviewApplication(store, reviewer, app.id, app.version, "approve", "Demo documents checked and accepted.", checks);
    expect(store.vehicles).toHaveLength(1);
    expect(store.vehicles[0]).toMatchObject({ ownerId: owner.id, ownerVerified: true, deviceId: owner.demoDeviceId, office: "GJ-03", heartbeat: null, declarationStatus: "Verified · installation pending" });
    expect(() => reviewApplication(store, reviewer, app.id, app.version, "approve", "Repeat approval rejected", checks)).toThrow("not awaiting");
    expect(() => verifyDemoInstallation(store, reviewer, app.id, app.version, "Demo mounting and seal checked")).toThrow("fresh demo");
    setupDemoDevice(store, owner, app.id, app.version);
    verifyDemoInstallation(store, reviewer, app.id, app.version, "Demo mounting and seal checked");
    expect(store.vehicles[0].declarationStatus).toBe("Verified · monitoring pending");
    expect(store.vehicles[0].gpsAt).toBeNull();
  });
  it("rejects stale saves, forged routing and unsupported districts", () => {
    const { store, owner, app } = fixture();
    expect(() => saveDraft(store, owner, app.id, app.version - 1, fields(), 3)).toThrow("another tab");
    expect(() => saveDraft(store, owner, app.id, app.version, { ...fields(), office: "GJ-01" }, 3)).toThrow("invalid");
    app.fields.area = "Outside Rajkot city / unsure";
    expect(() => submitApplication(store, owner, app.id, app.version)).toThrow("attention");
    expect(routeOffice({ district: "Ahmedabad", area: "Rajkot city" })).toBeNull();
  });
  it("rejects invalid activation codes, duplicate claims, incomplete evidence and duplicate vehicles", () => {
    const { store, owner, other, app } = fixture();
    const second = enrollmentState(store).applications.find(a => a.ownerId === other.id)!;
    expect(() => claimDevice(store, other, second.id, second.version, owner.demoDeviceId!, "wrong")).toThrow("incorrect");
    expect(() => claimDevice(store, other, second.id, second.version, owner.demoDeviceId!, demoActivationCode(owner.demoDeviceId!))).toThrow("already claimed");
    const documents = app.documents; app.documents = [];
    expect(() => submitApplication(store, owner, app.id, app.version)).toThrow("attention");
    app.documents = documents; submitApplication(store, owner, app.id, app.version);
    claimDevice(store, other, second.id, second.version, other.demoDeviceId!, demoActivationCode(other.demoDeviceId!));
    saveDraft(store, other, second.id, second.version, fields(), 5); second.documents = structuredClone(documents);
    expect(() => submitApplication(store, other, second.id, second.version)).toThrow("already has");
  });
  it("releases a rejected reservation while preserving the decision", () => {
    const { store, owner, reviewer, app } = fixture();
    submitApplication(store, owner, app.id, app.version);
    reviewApplication(store, reviewer, app.id, app.version, "reject", "The supplied ownership evidence does not match.");
    expect(enrollmentState(store).devices.find(d => d.id === app.deviceId)?.applicationId).toBeNull();
    expect(app.history.at(-1)?.note).toContain("ownership");
  });
});

describe("Gujarat pilot validation and uploads", () => {
  it("uses IST dates, validates calendar dates and makes representative evidence conditional", () => {
    expect(indiaToday(new Date("2026-11-25T20:00:00Z"))).toBe("2026-11-26");
    const f = fields(); expect(validateFields(f)).toEqual({});
    expect(validateFields({ ...f, startsOn: "2027-02-30" })).toHaveProperty("startsOn");
    expect(requiredDocuments({ ...f, capacity: "Authorized representative", reason: "Accident" })).toContain("authority");
    expect(requiredDocuments({ ...f, category: "Private vehicle" })).not.toContain("fitness");
    expect(requiredDocuments(f)).not.toContain("photo");
    expect(reviewFlags({ ...f, startsOn: "2026-12-01", endsOn: "2027-05-01", taxPaidThrough: "2027-01-01" }, "2026-11-26")).toHaveLength(2);
  });
  it("checks content, extension, MIME, size and active PDF features", () => {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj <</Type /Catalog>> endobj\n%%EOF");
    expect(validateUpload(pdf, "sample.pdf", "application/pdf", "rc")).toBe("application/pdf");
    expect(() => validateUpload(Buffer.from("<html>not a pdf</html>"), "sample.pdf", "application/pdf", "rc")).toThrow("content");
    expect(() => validateUpload(pdf, "sample.jpg", "image/jpeg", "rc")).toThrow("content");
    expect(() => validateUpload(pdf, "sample.pdf", "application/pdf", "photo")).toThrow("profile photo");
    expect(() => validateUpload(Buffer.from("%PDF-1.4\n/JavaScript\n%%EOF"), "sample.pdf", "application/pdf", "rc")).toThrow("plain PDF");
    expect(() => validateUpload(Buffer.alloc(6 * 1024 * 1024), "big.pdf", "application/pdf", "rc")).toThrow("5 MB");
  });
});
