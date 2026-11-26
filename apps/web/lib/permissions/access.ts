import type { TaxPermission } from "../tax/types";
export type Role = "national_admin" | "state_admin" | "rto_admin" | "rto_manager" | "enforcement_officer" | "registration_operator" | "device_technician" | "auditor" | "vehicle_owner" | "technical_admin";
export type Permission = "geofences.manage" | "applications.read" | "applications.review" | "summary.read" | "states.read" | "offices.read" | "vehicles.read" | "vehicles.draft" | "vehicles.approve" | "locations.read" | "declarations.read" | "alerts.read" | "alerts.acknowledge" | "cases.read" | "cases.assign" | "cases.note" | "devices.read" | "devices.maintain" | "employees.read" | "audit.read" | "reports.export" | "requests.read" | "requests.create" | "requests.review" | "finance.read" | "telemetry.simulate" | TaxPermission;
export interface Account { mode?:"live"|"demo"; demoDeviceId?:string; id:string; name:string; role:Role; designation:string; employeeId:string; email:string; state:string|null; office:string|null; status:"Active"|"Suspended"; assignedVehicleIds:string[]; additionalPermissions:Permission[]; }
export const roleNames: Record<Role,string> = { national_admin:"National Administrator",state_admin:"State Administrator",rto_admin:"RTO Administrator",rto_manager:"RTO Manager",enforcement_officer:"Enforcement Officer",registration_operator:"Registration Operator",device_technician:"Device Technician",auditor:"Read-only Auditor",vehicle_owner:"Vehicle Owner",technical_admin:"Technical Administrator" };
const grants: Record<Role,Permission[]> = {
 national_admin:["summary.read","states.read","offices.read","devices.read","employees.read","audit.read","reports.export","finance.read"],
 state_admin:["summary.read","offices.read","devices.read","employees.read","audit.read","reports.export","finance.read"],
 rto_admin:["geofences.manage","applications.read","applications.review","summary.read","vehicles.read","vehicles.draft","vehicles.approve","locations.read","declarations.read","alerts.read","alerts.acknowledge","cases.read","cases.assign","cases.note","devices.read","employees.read","audit.read","reports.export","requests.read","requests.review","finance.read"],
 rto_manager:["applications.read","summary.read","vehicles.read","locations.read","declarations.read","alerts.read","alerts.acknowledge","cases.read","cases.assign","cases.note","devices.read","reports.export","requests.read","requests.review"],
 enforcement_officer:["summary.read","vehicles.read","locations.read","declarations.read","alerts.read","alerts.acknowledge","cases.read","cases.note","devices.read","reports.export"],
 registration_operator:["applications.read","summary.read","vehicles.read","vehicles.draft","declarations.read","devices.read"],
 device_technician:["summary.read","devices.read","devices.maintain"],
 auditor:["summary.read","vehicles.read","declarations.read","devices.read","reports.export"],
 vehicle_owner:["applications.read","summary.read","vehicles.read","locations.read","declarations.read","alerts.read","requests.read","requests.create","reports.export"],
 technical_admin:["summary.read","devices.read","devices.maintain","audit.read","telemetry.simulate"],
};
const taxGrants:Record<Role,TaxPermission[]>={
 national_admin:["tax.analytics.read","tax.rules.read","tax.reports.export"],
 state_admin:["tax.analytics.read","tax.rules.read","tax.rules.draft","tax.rules.review","tax.reports.export"],
 rto_admin:["tax.analytics.read","tax.exposure.read","tax.assessment.read","tax.assessment.simulate","tax.assessment.prepare","tax.assessment.review","tax.assessment.revise","tax.case.assign","tax.case.investigate","tax.evidence.read","tax.evidence.append","tax.owner_response.review","tax.notice.prepare","tax.payment.read","tax.rules.read","tax.appeal.read","tax.audit.read","tax.reports.export"],
 rto_manager:["tax.analytics.read","tax.exposure.read","tax.assessment.read","tax.assessment.simulate","tax.assessment.prepare","tax.assessment.review","tax.case.assign","tax.case.investigate","tax.evidence.read","tax.evidence.append","tax.owner_response.review","tax.notice.prepare","tax.payment.read","tax.rules.read","tax.appeal.read"],
 enforcement_officer:["tax.exposure.read","tax.assessment.read","tax.assessment.simulate","tax.case.investigate","tax.evidence.read","tax.evidence.append","tax.owner_response.review","tax.rules.read"],
 registration_operator:[],device_technician:[],technical_admin:[],
 vehicle_owner:["tax.assessment.read","tax.evidence.read","tax.owner_response.submit","tax.payment.read","tax.appeal.read"],
 auditor:["tax.analytics.read","tax.assessment.read","tax.payment.read","tax.rules.read","tax.appeal.read","tax.audit.read"],
};
export function permissionsFor(account:Account):Permission[] { return account.status === "Active" ? [...new Set([...grants[account.role],...taxGrants[account.role],...account.additionalPermissions])].filter(p=>account.mode!=="live"||(!p.startsWith("tax.")&&!(["telemetry.simulate","vehicles.draft","vehicles.approve","finance.read"] as string[]).includes(p))) : []; }
export function can(account:Account,permission:Permission){return permissionsFor(account).includes(permission)}
export interface ScopedRecord { id:string; state:string; office:string; ownerId?:string; ownerVerified?:boolean; }
export function inJurisdiction(account:Account,record:ScopedRecord){
 if(account.status !== "Active") return false;
 if(account.role === "vehicle_owner") return record.ownerVerified === true && record.ownerId === account.id;
 if(account.role === "national_admin" || account.role === "technical_admin") return true;
 if(account.role === "state_admin") return record.state === account.state;
 if(record.office !== account.office || record.state !== account.state) return false;
 if(account.role === "enforcement_officer" || account.role === "device_technician") return account.assignedVehicleIds.includes(record.id);
 return true;
}
export const navigation = [
 {id:"overview",label:"Overview",permission:"summary.read",group:"Workspace"},
 {id:"states",label:"States & territories",permission:"states.read",group:"Workspace"},
 {id:"offices",label:"RTO offices",permission:"offices.read",group:"Workspace"},
 {id:"applications",label:"Applications",permission:"applications.read",group:"Workspace"},
 {id:"vehicles",label:"Vehicle registry",permission:"vehicles.read",group:"Workspace"},
 {id:"monitoring",label:"Location monitoring",permission:"locations.read",group:"Workspace"},
 {id:"declarations",label:"Non-Use declarations",permission:"declarations.read",group:"Workspace"},
 {id:"alerts",label:"Alerts & events",permission:"alerts.read",group:"Operations"},
 {id:"investigations",label:"Investigations",permission:"cases.read",group:"Operations"},
 {id:"requests",label:"Movement requests",permission:"requests.read",group:"Operations"},
 {id:"devices",label:"Device health",permission:"devices.read",group:"Operations"},
 {id:"simulator",label:"Hardware simulator",permission:"telemetry.simulate",group:"Operations"},
 {id:"employees",label:"Team & access",permission:"employees.read",group:"Administration"},
 {id:"compliance",label:"Financial intelligence",permission:"tax.assessment.read",group:"Administration"},
 {id:"revenue",label:"Revenue intelligence",permission:"tax.analytics.read",group:"Administration"},
 {id:"tax-rules",label:"Tax rule registry",permission:"tax.rules.read",group:"Administration"},
 {id:"reports",label:"Reports & exports",permission:"reports.export",group:"Administration"},
 {id:"audit",label:"Audit trail",permission:"audit.read",group:"Administration"},
] as const;
export function portalFor(account:Account){return account.role === "vehicle_owner" ? "owner" : account.role === "technical_admin" ? "ops" : "gov"}
