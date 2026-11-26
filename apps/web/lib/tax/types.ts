export type IntegrationMode = "DEMO" | "MANUAL" | "OFFICIAL";
export type TaxPermission = "tax.analytics.read" | "tax.exposure.read" | "tax.assessment.read" | "tax.assessment.simulate" | "tax.assessment.prepare" | "tax.assessment.review" | "tax.assessment.approve" | "tax.assessment.revise" | "tax.case.assign" | "tax.case.investigate" | "tax.evidence.read" | "tax.evidence.append" | "tax.owner_response.submit" | "tax.owner_response.review" | "tax.notice.prepare" | "tax.notice.issue" | "tax.payment.read" | "tax.payment.reconcile" | "tax.rules.read" | "tax.rules.draft" | "tax.rules.review" | "tax.rules.publish" | "tax.appeal.read" | "tax.audit.read" | "tax.reports.export";
export type ReviewStatus = "Pending evidence validation" | "Under preliminary review" | "Owner explanation requested" | "Owner response received" | "Under investigation" | "Assessment proposed" | "Pending authorized decision" | "Violation established by authority" | "Closed without established liability";
export interface TaxRule {
 id:string; version:number; state:string; office:string|null; category:string; mode:IntegrationMode;
 status:"Draft"|"Pending verification"|"Verified"|"Active"|"Superseded";
 title:string; provision:string; schedule:string; notification:string|null; sourceUrl:string;
 effectiveFrom:string; effectiveTo:string; ratePaise:number|null; unit:"assessable period";
 method:"fixed_period"|"unverified"; conditions:string; exemptions:string; rounding:"integer paise";
 verifiedBy:string|null; approvedBy:string|null; createdBy:string; createdAt:string;
}
export interface MovementEvidence {
 id:string; eventIds:string[]; vehicleId:string; declarationId:string; state:string; office:string; deviceId:string;
 startAt:string; endAt:string; durationSeconds:number|null; distanceMeters:number|null;
 route:{lat:number;lng:number;at:string;accuracy:number}[]; gpsAccuracy:number|null;
 geofenceDepartureAt:string|null; geofenceReturnAt:string|null; accelerometer:null; ignition:null;
 tamper:boolean; health:string; permissionId:string|null; permissionStatus:string; algorithmVersion:string;
 classification:"Unverified movement"|"Suspected GPS drift"|"Authorized movement"|"Possible towing or relocation"|"Device tampering"|"Insufficient telemetry"|"Normal stationary activity";
 observed:string; inference:string; integrityHash:string; authentication:"Synthetic simulator event";
 source:"DEMO"; disclosed:boolean;
}
export interface EvidenceReview { evidenceId:string; disposition:"Relied upon"|"Inconclusive"|"Excluded"; reason:string; actor:string; at:string }
export interface TaxCase {
 declarationId:string; lifecycle:ReviewStatus; evidenceIds:string[]; evidenceReviews:EvidenceReview[];
 disclosed:boolean; responseRequestedAt:string|null; responseDeadline:string|null;
 history:{id:string;at:string;actor:string;action:string;reason:string;disclosed:boolean}[];
}
export interface Calculation {
 version:"tax-calc-v1"; mode:IntegrationMode; rule:TaxRule; periodStart:string; periodEnd:string;
 basePaise:number; penaltyPaise:number; totalPaise:number; creditsPaise:0;
 penalty:"none"|"18(1A)"; explanation:string; evidenceIds:string[];
}
export interface Assessment {
 id:string; caseId:string; vehicleId:string; declarationId:string; state:string; office:string; mode:IntegrationMode;
 revision:number; replacesId:string|null; calculation:Calculation; status:"Proposed"|"Under review"|"Approved"|"Returned"|"Superseded"|"Cancelled";
 preparedBy:string; preparedAt:string; reviewedBy:string|null; approvedBy:string|null; approvedAt:string|null;
 reason:string; disclosed:boolean; evidenceHash:string;
}
export interface OwnerResponse {id:string;caseId:string;ownerId:string;kind:string;text:string;permissionReference:string|null;documentIds:string[];at:string;reviewedBy:string|null;reviewReason:string|null}
export interface TaxDocument {id:string;caseId:string;uploader:string;name:string;mime:string;bytes:number;sha256:string;base64:string;at:string;disclosed:boolean}
export interface RegulatoryNotice {id:string;caseId:string;assessmentId:string;mode:IntegrationMode;status:"Draft"|"Issued"|"Cancelled";reference:string;reason:string;preparedBy:string;issuedBy:string|null;issuedAt:string|null;responseDeadline:string|null;serviceReference:string|null}
export interface TaxPayment {id:string;noticeId:string;reference:string;amountPaise:number;mode:IntegrationMode;reconciledBy:string;at:string;sourceReference:string}
export interface TaxAppeal {id:string;caseId:string;assessmentId:string;reference:string;status:"Recorded"|"Disposed";stay:boolean;stayReference:string|null;reason:string;recordedBy:string;at:string;mode:IntegrationMode}
export interface StatutoryAuthorization {id:string;accountId:string;state:string;office:string|null;actions:TaxPermission[];mode:IntegrationMode;reference:string;verifiedBy:string;validFrom:string;validTo:string;revokedAt:string|null}
export interface TaxAudit {id:string;actor:string;action:string;entity:string;state:string|null;office:string|null;reason:string;at:string;previousHash:string;hash:string;mode:IntegrationMode}
export interface TaxState {
 version:1; rules:TaxRule[]; evidence:MovementEvidence[]; assessments:Assessment[]; responses:OwnerResponse[];
 documents:TaxDocument[]; notices:RegulatoryNotice[]; payments:TaxPayment[]; appeals:TaxAppeal[];
 authorizations:StatutoryAuthorization[]; audit:TaxAudit[];
 requests:{id:string;actor:string;fingerprint:string;result:Record<string,unknown>}[];
}
