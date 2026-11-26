export type ApplicationStatus = "Draft" | "Submitted" | "Under review" | "Changes requested" | "Rejected" | "Approved";
export type DocumentKind = "rc" | "tax" | "fitness" | "authority" | "nonuse" | "supporting" | "photo";

export interface EnrollmentFields {
  fullName: string; mobile: string; email: string; address: string; ownerPincode: string;
  capacity: string; registeredOwner: string;
  registration: string; category: string; model: string; chassis: string; fuel: string; year: string;
  taxReference: string; taxAuthority: string; taxPaidThrough: string; previousDeclaration: string;
  startsOn: string; endsOn: string; reason: string; reasonDetails: string; incidentOn: string;
  parkingAddress: string; parkingPincode: string; district: string; area: string;
  latitude: string; longitude: string; declarationAccepted: boolean;
}
export interface EnrollmentDocument {
  storagePath?: string; id: string; kind: DocumentKind; name: string; mime: string; size: number; sha256: string;
  uploadedAt: string; removedAt: string | null;
}
export interface ApplicationAction {
  id: string; at: string; actorId: string; actorName: string; action: string; note: string;
}
export interface ApplicationRevision {
  number: number; submittedAt: string; fields: EnrollmentFields; documentIds: string[];
  deviceId: string; office: string; policyVersion: string;
}
export interface EnrollmentApplication {
  id: string; ownerId: string; status: ApplicationStatus; version: number; step: number;
  fields: EnrollmentFields; deviceId: string | null; office: string | null;
  createdAt: string; updatedAt: string; submittedAt: string | null;
  documents: EnrollmentDocument[]; history: ApplicationAction[]; revisions: ApplicationRevision[];
  vehicleId: string | null; approvedBy: string | null; installationVerifiedAt: string | null;
}
export interface EnrollmentDevice {
  id: string; serial: string; claimHash: string; reservedBy: string | null;
  applicationId: string | null; assignedVehicleId: string | null;
  source: "DEMO" | "HARDWARE"; lastSetupAt: string | null;
}
export interface EnrollmentState { applications: EnrollmentApplication[]; devices: EnrollmentDevice[]; claimAttempts: Record<string, { count: number; until: number }> }
export const emptyFields: EnrollmentFields = {
  fullName: "", mobile: "", email: "", address: "", ownerPincode: "", capacity: "Registered owner", registeredOwner: "",
  registration: "", category: "Goods carrier", model: "", chassis: "", fuel: "Diesel", year: "",
  taxReference: "", taxAuthority: "", taxPaidThrough: "", previousDeclaration: "",
  startsOn: "", endsOn: "", reason: "Planned non-use", reasonDetails: "", incidentOn: "",
  parkingAddress: "", parkingPincode: "", district: "Rajkot", area: "", latitude: "", longitude: "", declarationAccepted: false,
};
