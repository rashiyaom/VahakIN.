import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { can, type Account } from "../permissions/access";
import { appendAudit, type DemoStore, type Vehicle } from "./demo-store";
import { emptyFields, type EnrollmentApplication, type EnrollmentFields, type EnrollmentState } from "../enrollment/types";
import { documentLabels, POLICY_VERSION, requiredDocuments, routeOffice } from "../enrollment/policy";
import { draftSchema, normalizeRegistration, validateFields, type FieldErrors } from "../enrollment/validation";

export class EnrollmentError extends Error {
  constructor(message: string, public status = 400, public fields: FieldErrors = {}) { super(message); }
}
export function enrollmentState(store: DemoStore): EnrollmentState {
  return store.enrollment ??= { applications: [], devices: [], claimAttempts: {} };
}
export const claimDigest = (code: string) => createHash("sha256").update(code.trim()).digest("hex");
export function demoActivationCode(deviceId: string) { return `DEMO-${deviceId.slice(9)}`; }
export function createApplicant(store: DemoStore): Account {
  const id = randomUUID();
  const account: Account = { id: `applicant-${id}`, name: "New owner", role: "vehicle_owner", designation: "Demo applicant", employeeId: `DEMO-${id.slice(0, 8)}`, email: "", state: null, office: null, status: "Active", assignedVehicleIds: [], additionalPermissions: [] };
  store.accounts.push(account);
  const deviceId = `IG-SETUP-${id.slice(0, 8).toUpperCase()}`;
  enrollmentState(store).devices.push({ id: deviceId, serial: `DEMO-SN-${id}`, claimHash: claimDigest(demoActivationCode(deviceId)), reservedBy: null, applicationId: null, assignedVehicleId: null, source: "DEMO", lastSetupAt: null });
  // The kit is attached to the demo identity only for discovery. Claiming still requires its code.
  account.demoDeviceId = deviceId;
  startApplication(store, account);
  return account;
}
export function startApplication(store: DemoStore, account: Account) {
  if (account.role !== "vehicle_owner" || account.status !== "Active") throw new EnrollmentError("Only an active owner can start an application.", 403);
  const state = enrollmentState(store);
  const existing = state.applications.find(a => a.ownerId === account.id && a.status !== "Rejected" && a.status !== "Approved");
  if (existing) return existing;
  const now = new Date().toISOString();
  const application: EnrollmentApplication = { id: `IG-APP-${randomUUID()}`, ownerId: account.id, status: "Draft", version: 1, step: 0, fields: { ...emptyFields, email: account.email, fullName: account.name === "New owner" ? "" : account.name }, deviceId: null, office: null, createdAt: now, updatedAt: now, submittedAt: null, documents: [], history: [], revisions: [], vehicleId: null, approvedBy: null, installationVerifiedAt: null };
  state.applications.push(application);
  recordAction(store, account, application, "Draft created", "Your application is private until you submit it.");
  return application;
}
export function canReadApplication(account: Account, application: EnrollmentApplication) {
  if (account.status !== "Active") return false;
  if (account.role === "vehicle_owner") return application.ownerId === account.id;
  return can(account, "applications.read") && application.submittedAt !== null && account.state === "Gujarat" && account.office === application.office;
}
export function getApplication(store: DemoStore, account: Account, id: string) {
  const application = enrollmentState(store).applications.find(a => a.id === id);
  if (!application || !canReadApplication(account, application)) throw new EnrollmentError("Application not found in your workspace.", 404);
  return application;
}
export function editableApplication(store: DemoStore, account: Account, id: string, version: number) {
  const application = getApplication(store, account, id);
  if (application.ownerId !== account.id || account.role !== "vehicle_owner") throw new EnrollmentError("Only the applicant can edit this application.", 403);
  checkVersion(application, version);
  if (!["Draft", "Changes requested"].includes(application.status)) throw new EnrollmentError("This application is locked for review. Refresh to see its latest status.", 409);
  return application;
}
export function checkVersion(application: EnrollmentApplication, version: number) {
  if (application.version !== version) throw new EnrollmentError("This application changed in another tab. Refresh before continuing.", 409);
}
export function touch(application: EnrollmentApplication) { application.version++; application.updatedAt = new Date().toISOString(); }
function recordAction(store: DemoStore, account: Account, app: EnrollmentApplication, action: string, note: string) {
  app.history.push({ id: randomUUID(), at: new Date().toISOString(), actorId: account.id, actorName: account.role === "vehicle_owner" ? "Applicant" : account.name, action, note });
  appendAudit(store, { ...account, state: "Gujarat", office: app.office }, action, app.id, note);
}
export function applicationView(store: DemoStore, account: Account) {
  const state = enrollmentState(store);
  const applications = state.applications.filter(a => canReadApplication(account, a)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  // While corrections are in progress, officials see the last submitted snapshot.
  const visible = applications.map(a => {
    if (account.role === "vehicle_owner" || a.status !== "Changes requested") return a;
    const revision = a.revisions.at(-1)!;
    const submittedDocuments = new Set(a.revisions.flatMap(r => r.documentIds));
    return { ...a, fields: revision.fields, deviceId: revision.deviceId, documents: a.documents.filter(d => submittedDocuments.has(d.id)) };
  });
  const ids = new Set(applications.map(a => a.deviceId));
  return { applications: visible, devices: state.devices.filter(d => ids.has(d.id)).map(({ id, serial, lastSetupAt, source }) => ({ id, serial, lastSetupAt, source })),
    demoKit: account.role === "vehicle_owner" && account.demoDeviceId ? { id: account.demoDeviceId, code: demoActivationCode(account.demoDeviceId) } : null };
}
export function saveDraft(store: DemoStore, account: Account, id: string, version: number, raw: unknown, step: number) {
  const app = editableApplication(store, account, id, version);
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) throw new EnrollmentError("Some fields are invalid or too long. Check your entries.");
  if (!Number.isInteger(step) || step < 0 || step > 5) throw new EnrollmentError("Invalid form step.");
  app.fields = parsed.data as EnrollmentFields;
  app.step = step;
  touch(app);
  return app;
}
export function claimDevice(store: DemoStore, account: Account, id: string, version: number, deviceId: string, code: string) {
  const app = editableApplication(store, account, id, version);
  const device = enrollmentState(store).devices.find(d => d.id === deviceId.trim().toUpperCase());
  const valid = device && timingSafeEqual(Buffer.from(device.claimHash, "hex"), Buffer.from(claimDigest(code), "hex"));
  if (!valid) throw new EnrollmentError("Device ID or activation code is incorrect. Check the card supplied with your device.");
  if (device.assignedVehicleId || device.applicationId && device.applicationId !== app.id) throw new EnrollmentError("This device is already claimed. Contact support if it belongs to you.", 409);
  if (app.deviceId && app.deviceId !== device.id) throw new EnrollmentError("Release your current device before claiming another.", 409);
  if (app.deviceId === device.id) return app;
  device.reservedBy = account.id; device.applicationId = app.id; app.deviceId = device.id;
  touch(app); recordAction(store, account, app, "Device claimed", `${device.id} reserved for this application. Installation is still to be verified.`);
  return app;
}
export function submitApplication(store: DemoStore, account: Account, id: string, version: number) {
  const app = getApplication(store, account, id);
  if (app.ownerId !== account.id) throw new EnrollmentError("Only the applicant can submit.", 403);
  // A retried successful submission is safe and does not duplicate the package.
  if (["Submitted", "Under review", "Approved"].includes(app.status)) return app;
  editableApplication(store, account, id, version);
  const errors = validateFields(app.fields);
  const device = enrollmentState(store).devices.find(d => d.id === app.deviceId && d.applicationId === app.id && d.reservedBy === account.id && !d.assignedVehicleId);
  if (!device) errors.deviceId = "Claim your device before submitting.";
  const missing = requiredDocuments(app.fields).filter(kind => !app.documents.some(d => d.kind === kind && !d.removedAt));
  if (missing.length) errors.documents = `Upload: ${missing.map(k => documentLabels[k]).join(", ")}.`;
  if (Object.keys(errors).length) throw new EnrollmentError("A few details need attention before you submit.", 422, errors);
  const registration = normalizeRegistration(app.fields.registration);
  if (store.vehicles.some(v => normalizeRegistration(v.registration) === registration) || enrollmentState(store).applications.some(a => a.id !== id && !["Draft", "Rejected"].includes(a.status) && normalizeRegistration(a.fields.registration) === registration)) throw new EnrollmentError("This vehicle already has an application or registration. Contact the responsible office.", 409);
  app.office = routeOffice(app.fields)!.code;
  app.status = "Submitted"; app.submittedAt = new Date().toISOString(); app.step = 5;
  app.revisions.push({ number: app.revisions.length + 1, submittedAt: app.submittedAt, fields: structuredClone(app.fields), documentIds: app.documents.filter(d => !d.removedAt).map(d => d.id), deviceId: app.deviceId!, office: app.office, policyVersion: POLICY_VERSION });
  touch(app); recordAction(store, account, app, "Application submitted", `Package ${app.revisions.length} delivered to the Rajkot RTO ${account.mode === "live" ? "" : "demo "}review queue (${app.office}).`);
  return app;
}
function registerApprovedVehicle(store: DemoStore, account: Account, app: EnrollmentApplication) {
  const f = app.fields, device = enrollmentState(store).devices.find(d => d.id === app.deviceId)!;
  if (device.assignedVehicleId || device.applicationId !== app.id) throw new EnrollmentError("Device assignment changed. Resolve it before approval.", 409);
  if (store.vehicles.some(v => normalizeRegistration(v.registration) === normalizeRegistration(f.registration))) throw new EnrollmentError("This vehicle is already registered.", 409);
  const vehicle: Vehicle = {
    id: `v-${randomUUID()}`, registration: normalizeRegistration(f.registration), state: "Gujarat", office: app.office!, district: f.district,
    ownerId: app.ownerId, ownerName: f.capacity === "Registered owner" ? f.fullName : f.registeredOwner, ownerVerified: true, mobile: f.mobile,
    category: f.category, model: f.model, fuel: f.fuel, year: Number(f.year), chassis: f.chassis, source: account.mode === "live" ? "MANUAL" : "MOCK", verification: account.mode === "live" ? "Reviewed by RTO" : "Reviewed in demo",
    declarationId: `${account.mode === "live" ? "NU" : "NU-DEMO"}-${randomUUID().slice(0, 8)}`, declarationStatus: "Verified · installation pending",
    startsAt: new Date(`${f.startsOn}T00:00:00+05:30`).toISOString(), endsAt: new Date(`${f.endsOn}T23:59:59+05:30`).toISOString(),
    parking: f.parkingAddress, parkingLat: f.latitude ? +f.latitude : null, parkingLng: f.longitude ? +f.longitude : null,
    lat: null, lng: null, accuracy: null, speed: null, motion: "Unknown", geofence: "Unknown", tamper: "Unknown", battery: null, voltage: null, signal: null,
    heartbeat: null, gpsAt: null, gpsStatus: "Unavailable", eventAt: null, receivedAt: null, processedAt: null, deviceId: device.id, firmware: "Unavailable",
    review: "Monitoring unavailable", createdBy: account.id, createdAt: new Date().toISOString(),
  };
  store.vehicles.push(vehicle); device.assignedVehicleId = vehicle.id; app.vehicleId = vehicle.id; app.approvedBy = account.id;
  const owner = store.accounts.find(a => a.id === app.ownerId); if (owner) owner.name = f.fullName;
}
export function reviewApplication(store: DemoStore, account: Account, id: string, version: number, decision: string, note: string, checks?: Record<string, boolean>) {
  const app = getApplication(store, account, id); checkVersion(app, version);
  if (!can(account, "applications.review") || account.id === app.ownerId) throw new EnrollmentError("An independent authorized RTO reviewer is required.", 403);
  if (!["Submitted", "Under review"].includes(app.status)) throw new EnrollmentError("This application is not awaiting a decision.", 409);
  if (!note || note.trim().length < 10 || note.length > 2000) throw new EnrollmentError("Give the applicant a clear explanation (10–2,000 characters).");
  const statuses: Record<string, EnrollmentApplication["status"]> = { begin: "Under review", changes: "Changes requested", reject: "Rejected", approve: "Approved" };
  if (!statuses[decision]) throw new EnrollmentError("Unknown review action.");
  if (decision === "approve") {
    if (!["identity", "ownership", "documents", "jurisdiction"].every(k => checks?.[k] === true)) throw new EnrollmentError("Confirm identity, ownership/authority, documents and parking jurisdiction before approval.");
    registerApprovedVehicle(store, account, app);
  }
  if (decision === "reject") {
    const device = enrollmentState(store).devices.find(d => d.applicationId === app.id);
    if (device) { device.applicationId = null; device.reservedBy = null; }
  }
  app.status = statuses[decision]; touch(app);
  recordAction(store, account, app, app.status === "Approved" ? (account.mode === "live" ? "Approved · installation pending" : "Approved in demo · installation pending") : app.status, note.trim());
  return app;
}
export function setupDemoDevice(store: DemoStore, account: Account, id: string, version: number) {
  const app = getApplication(store, account, id); checkVersion(app, version);
  if (account.id !== app.ownerId || app.status === "Rejected") throw new EnrollmentError("This setup check is unavailable.", 403);
  const device = enrollmentState(store).devices.find(d => d.id === app.deviceId && d.applicationId === app.id);
  if (!device) throw new EnrollmentError("Claim a device first.");
  device.lastSetupAt = new Date().toISOString(); touch(app);
  recordAction(store, account, app, "Demo connection check", "Simulated setup heartbeat only. No physical device connection or GPS verification.");
  return app;
}
export function verifyDemoInstallation(store: DemoStore, account: Account, id: string, version: number, note: string) {
  const app = getApplication(store, account, id); checkVersion(app, version);
  if (!can(account, "applications.review") || app.ownerId === account.id) throw new EnrollmentError("An independent RTO reviewer is required.", 403);
  if (app.status !== "Approved" || !app.vehicleId || app.installationVerifiedAt) throw new EnrollmentError("Installation is not awaiting verification.", 409);
  const device = enrollmentState(store).devices.find(d => d.id === app.deviceId);
  if (!device?.lastSetupAt || Date.now() - Date.parse(device.lastSetupAt) > 30 * 60000) throw new EnrollmentError(account.mode === "live" ? "A recent authenticated device heartbeat is required before installation can be verified." : "Ask the owner to run a fresh demo connection check first.");
  if (note.trim().length < 10 || note.length > 2000) throw new EnrollmentError("Record installation and seal details (10–2,000 characters).");
  const vehicle = store.vehicles.find(v => v.id === app.vehicleId)!;
  app.installationVerifiedAt = new Date().toISOString();
  // No synthetic location is fabricated, and setup approval never activates regulatory monitoring.
  vehicle.declarationStatus = "Verified · monitoring pending";
  touch(app); recordAction(store, account, app, account.mode === "live" ? "Installation verified" : "Installation verified in demo", note.trim());
  return app;
}
