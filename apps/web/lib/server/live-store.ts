import { EnrollmentError } from "./enrollment";
import { adminClient } from "../supabase/server";
import { roleNames, type Account, type Role } from "../permissions/access";
import { readStore, withStoreTransaction, type DemoStore } from "./demo-store";
import type { EnrollmentApplication, EnrollmentDocument, ApplicationRevision, ApplicationAction, EnrollmentDevice } from "../enrollment/types";

type Profile = { id: string; display_name: string; email: string; role: Role; state: string | null; office: string | null; status: "Active" | "Suspended"; assigned_vehicle_ids: string[] };
export function profileAccount(p: Profile): Account { return { id: p.id, name: p.display_name || "Vehicle owner", email: p.email, role: p.role, state: p.state, office: p.office, status: p.status, assignedVehicleIds: p.assigned_vehicle_ids, designation: roleNames[p.role], employeeId: "", additionalPermissions: [], mode: "live" }; }
export async function liveAccount(id: string) {
  const { data, error } = await adminClient().from("ig_profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Unable to load your account. Please try again.");
  return data?.status === "Active" ? profileAccount(data as Profile) : null;
}
interface Snapshot {
  version: number; profiles: Profile[]; applications: EnrollmentApplication[]; vehicles: DemoStore["vehicles"]; devices: EnrollmentDevice[];
  documents: { applicationId: string; payload: EnrollmentDocument }[]; revisions: { applicationId: string; payload: ApplicationRevision }[]; history: { applicationId: string; payload: ApplicationAction }[];
  work: { kind: string; payload: unknown }[];
}
export async function accountStore(account: Account): Promise<DemoStore> {
  if (account.mode !== "live") return readStore();
  const { data, error } = await adminClient().rpc("ig_read_workspace", { p_actor: account.id });
  if (error || !data) throw new Error("Unable to load your workspace. Please retry.");
  const s = data as Snapshot;
  const store: DemoStore = { mode: "live", version: s.version, accounts: s.profiles.map(profileAccount), vehicles: s.vehicles, alerts: [], cases: [], requests: [], audit: [], sessions: [], maintenance: [], classificationChanges: [], enrollment: { applications: s.applications.map(a => ({ ...a,
    documents: s.documents.filter(d => d.applicationId === a.id).map(d => d.payload),
    revisions: s.revisions.filter(d => d.applicationId === a.id).map(d => d.payload).sort((a,b) => a.number-b.number),
    history: s.history.filter(d => d.applicationId === a.id).map(d => d.payload).sort((a,b) => a.at.localeCompare(b.at)),
  })), devices: s.devices, claimAttempts: {} } };
  for (const kind of ["alerts", "cases", "requests", "audit", "maintenance", "classificationChanges"] as const) (store[kind] as unknown[]) = s.work.filter(w => w.kind === kind).map(w => w.payload);
  return store;
}
type Change = { kind: string; id: string; payload: unknown; applicationId?: string; office?: string | null; vehicleId?: string | null };
function records(store: DemoStore): Change[] {
  const result: Change[] = [];
  for (const a of store.enrollment?.applications ?? []) {
    const { documents, revisions, history, ...payload } = a;
    result.push({ kind: "applications", id: a.id, payload });
    documents.forEach(d => result.push({ kind: "documents", id: d.id, payload: d, applicationId: a.id }));
    revisions.forEach(r => result.push({ kind: "revisions", id: `${a.id}:${r.number}`, payload: r, applicationId: a.id }));
    history.forEach(h => result.push({ kind: "history", id: h.id, payload: h, applicationId: a.id }));
  }
  store.enrollment?.devices.forEach(d => result.push({ kind: "devices", id: d.id, payload: d }));
  store.vehicles.forEach(v => result.push({ kind: "vehicles", id: v.id, payload: v }));
  store.accounts.forEach(a => result.push({ kind: "profiles", id: a.id, payload: { name: a.name } }));
  for (const kind of ["alerts", "cases", "requests", "audit", "maintenance", "classificationChanges"] as const) for (const row of store[kind] ?? []) {
    const item = row as unknown as { id: string; vehicleId?: string; deviceId?: string; office?: string | null };
    const vehicle = store.vehicles.find(v => v.id === item.vehicleId || item.deviceId && v.deviceId === item.deviceId);
    result.push({ kind, id: item.id, payload: row, office: item.office ?? vehicle?.office ?? null, vehicleId: vehicle?.id ?? null });
  }
  return result;
}
export async function accountTransaction<T>(account: Account, operation: (store: DemoStore) => T, options?: { deviceId?: string }) {
  if (account.mode !== "live") return withStoreTransaction(operation);
  const store = await accountStore(account);
  if (options?.deviceId && !store.enrollment!.devices.some(d => d.id === options.deviceId)) {
    const { data, error } = await adminClient().from("ig_devices").select("payload,claim_hash").eq("id", options.deviceId).maybeSingle();
    if (error) throw new Error("Unable to look up this device.");
    if (data) store.enrollment!.devices.push({ ...data.payload, claimHash: data.claim_hash });
  }
  const before = new Map(records(store).map(r => [`${r.kind}:${r.id}`, JSON.stringify(r)]));
  const result = operation(store);
  if (result instanceof Response && !result.ok) return result;
  const changes = records(store).filter(r => before.get(`${r.kind}:${r.id}`) !== JSON.stringify(r));
  if (changes.length) {
    const { error } = await adminClient().rpc("ig_commit_workspace", { p_actor: account.id, p_expected: store.version, p_changes: changes });
    if (error) throw new EnrollmentError(error.code === "23505" ? "This device or vehicle already has a registration or pending application." : error.code === "40001" ? "Workspace changed. Refresh and retry." : "Unable to save the application transaction. Please retry or contact your office.", ["23505", "40001"].includes(error.code) ? 409 : 503);
  }
  return result;
}
export async function limitAttempts(key: string, limit = 10, seconds = 900) {
  const { data, error } = await adminClient().rpc("ig_rate_limit", { p_key: key, p_limit: limit, p_window: seconds });
  if (error) throw new Error("Unable to verify the request limit. Please retry.");
  return data === true;
}
