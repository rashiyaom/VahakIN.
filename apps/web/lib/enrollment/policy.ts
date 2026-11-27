import type { DocumentKind, EnrollmentFields } from "./types";

export const POLICY_VERSION = "GJ-RAJKOT-PILOT-2026-11-26";
export const governmentSources = [
  { title: "Gujarat tax rules · Rule 5 and Form NT", url: "https://upload.indiacode.nic.in/showfile?actid=AC_GJ_66_317_00005_00005_1543661645124&filename=bombay_motor_vehicle_tax_rules-1959.pdf&type=rule" },
  { title: "Supreme Court · Gujarat Non-Use provisions", url: "https://gujarathighcourt.nic.in/hccms/sites/default/files/scgujaratijudgments/eng/CA_6462_of_2001.pdf" },
];
// Pilot service area, not a surveyed jurisdiction boundary or a distance lookup.
export function routeOffice(fields: Pick<EnrollmentFields, "district" | "area">) {
  if (fields.district === "Gandhinagar" && fields.area === "Gandhinagar city") return { code: "GJ-21", name: "Gandhinagar RTO", state: "Gujarat", basis: "Gandhinagar parking address · demonstration service area" };
  return fields.district === "Rajkot" && fields.area === "Rajkot city" ? { code: "GJ-03", name: "Rajkot RTO", state: "Gujarat", basis: "Rajkot city parking address · pilot service area" } : null;
}
export const documentLabels: Record<DocumentKind, string> = {
  rc: "Registration certificate (RC)", tax: "Certificate of taxation / tax receipt",
  fitness: "Fitness certificate", authority: "Authority to act for the owner",
  nonuse: "Signed Form NT", supporting: "Supporting evidence", photo: "Profile photo",
};
export function requiredDocuments(fields: EnrollmentFields): DocumentKind[] {
  return ["rc", "tax", "nonuse", ...(fields.category !== "Private vehicle" ? ["fitness" as const] : []),
    ...(fields.capacity !== "Registered owner" ? ["authority" as const] : []),
    ...(fields.reason !== "Planned non-use" ? ["supporting" as const] : [])];
}
export function indiaToday(now = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
export function reviewFlags(fields: EnrollmentFields, today = indiaToday()): string[] {
  const flags: string[] = [];
  if (fields.startsOn <= today) flags.push("Non-Use starts today or earlier. Check filing timing and any exception with the applicant.");
  if (fields.taxPaidThrough && fields.endsOn > fields.taxPaidThrough) flags.push("Requested period extends beyond the stated tax-paid period. Authority review required.");
  if (fields.startsOn && fields.endsOn) {
    const year = Number(fields.startsOn.slice(0, 4)) + (Number(fields.startsOn.slice(5, 7)) > 3 ? 1 : 0);
    if (fields.endsOn > `${year}-03-31`) flags.push("Period crosses a financial year. Confirm the applicable Form NT and current instructions.");
  }
  if (fields.incidentOn && Date.parse(`${today}T00:00:00Z`) - Date.parse(`${fields.incidentOn}T00:00:00Z`) > 7 * 86400000) flags.push("Incident reported more than seven days later. Check exception eligibility; no automatic acceptance.");
  return flags;
}
