import { z } from "zod";
import { emptyFields, type EnrollmentFields } from "./types";
import { indiaToday, routeOffice } from "./policy";

export const draftSchema = z.object(Object.fromEntries(Object.keys(emptyFields).map(key => [key, key === "declarationAccepted" ? z.boolean() : z.string().max(2000)])) as unknown as Record<keyof EnrollmentFields, z.ZodType>).strict();
export type FieldErrors = Partial<Record<keyof EnrollmentFields | "deviceId" | "documents", string>>;
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export const normalizeRegistration = (value: string) => value.toUpperCase().replace(/[\s-]/g, "");
export function validateFields(f: EnrollmentFields, step?: number, today = indiaToday()): FieldErrors {
  const e: FieldErrors = {};
  const check = (s: number) => step === undefined || step === s;
  if (check(1)) {
    if (f.fullName.trim().length < 2 || f.fullName.length > 100) e.fullName = "Enter the applicant’s full name (2–100 characters).";
    if (!/^[6-9]\d{9}$/.test(f.mobile)) e.mobile = "Enter a 10-digit Indian mobile number.";
    if (f.email && !z.email().safeParse(f.email).success) e.email = "Enter a valid email, or leave this optional field blank.";
    if (f.address.trim().length < 10 || f.address.length > 500) e.address = "Enter your full postal address (10–500 characters).";
    if (!/^[1-9]\d{5}$/.test(f.ownerPincode)) e.ownerPincode = "Enter a 6-digit PIN code.";
    if (!["Registered owner", "Authorized representative"].includes(f.capacity)) e.capacity = "Choose how you are applying.";
    if (f.capacity !== "Registered owner" && f.registeredOwner.trim().length < 2) e.registeredOwner = "Enter the registered owner’s name.";
  }
  if (check(2)) {
    if (!/^[A-Z]{2}\d{2}[A-Z]{1,3}\d{1,4}$/.test(normalizeRegistration(f.registration))) e.registration = "Enter a registration such as GJ 03 ZZ 1234. Special formats need assisted enrolment.";
    if (!["Goods carrier", "Passenger bus", "Light commercial", "Private vehicle"].includes(f.category)) e.category = "Choose a vehicle category.";
    if (f.model.trim().length < 2 || f.model.length > 100) e.model = "Enter the make and model shown on the RC.";
    if (!/^[A-Za-z0-9-]{5,25}$/.test(f.chassis)) e.chassis = "Enter the chassis number from the RC (5–25 letters or numbers).";
    if (!/^\d{4}$/.test(f.year) || +f.year < 1950 || +f.year > +today.slice(0, 4)) e.year = "Enter a valid manufacture year.";
    if (!["Diesel", "Petrol", "CNG", "Electric", "Hybrid", "Other"].includes(f.fuel)) e.fuel = "Choose a fuel type.";
    if (f.taxReference.trim().length < 2) e.taxReference = "Enter the tax certificate or receipt reference.";
    if (f.taxAuthority.trim().length < 2) e.taxAuthority = "Enter the authority shown on your tax record.";
    if (!validDate(f.taxPaidThrough)) e.taxPaidThrough = "Enter the tax-paid-through date from your record.";
  }
  if (check(3)) {
    if (!validDate(f.startsOn)) e.startsOn = "Choose a valid start date.";
    if (!validDate(f.endsOn) || f.endsOn < f.startsOn) e.endsOn = "Choose an end date on or after the start date.";
    if (validDate(f.endsOn) && f.endsOn < today) e.endsOn = "This onboarding flow needs a current or future period. Contact the office for historical claims.";
    if (!["Planned non-use", "Accident", "Mechanical defect", "Other exceptional cause"].includes(f.reason)) e.reason = "Choose a reason.";
    if (f.reason === "Planned non-use" && validDate(f.startsOn) && f.startsOn <= today) e.startsOn = "For planned non-use, choose a future start date. An incident needs the appropriate reason and evidence.";
    if (f.reason !== "Planned non-use" && (!validDate(f.incidentOn) || f.incidentOn > today || f.incidentOn > f.startsOn)) e.incidentOn = "Enter an incident date no later than today or the requested start.";
    if (f.reasonDetails.trim().length < 15 || f.reasonDetails.length > 1000) e.reasonDetails = "Briefly explain the reason (15–1,000 characters).";
    if (f.parkingAddress.trim().length < 10 || f.parkingAddress.length > 500) e.parkingAddress = "Enter the full address where the vehicle will remain parked.";
    if (!/^[1-9]\d{5}$/.test(f.parkingPincode)) e.parkingPincode = "Enter a 6-digit parking PIN code.";
    if (!routeOffice(f)) e.area = "Select a supported Rajkot or Gandhinagar parking area. Other areas need office-assisted routing.";
    if ((f.latitude === "") !== (f.longitude === "")) e.latitude = "Provide both coordinates, or leave both blank.";
    if (f.latitude && (!Number.isFinite(+f.latitude) || +f.latitude < -90 || +f.latitude > 90)) e.latitude = "Latitude must be between −90 and 90.";
    if (f.longitude && (!Number.isFinite(+f.longitude) || +f.longitude < -180 || +f.longitude > 180)) e.longitude = "Longitude must be between −180 and 180.";
  }
  if (check(5) && !f.declarationAccepted) e.declarationAccepted = "Confirm the declaration before submitting.";
  return e;
}
