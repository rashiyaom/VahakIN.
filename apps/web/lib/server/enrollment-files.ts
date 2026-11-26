import path from "node:path";
import { EnrollmentError } from "./enrollment";
import type { DocumentKind } from "../enrollment/types";
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const uploadDirectory = path.join(process.cwd(), ".data", "onboarding-files");
export function validateUpload(bytes: Buffer, name: string, mime: string, kind: DocumentKind) {
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) throw new EnrollmentError("Choose a non-empty file up to 5 MB.", 413);
  const pdf = bytes.subarray(0, 5).toString() === "%PDF-" && bytes.subarray(-1024).toString().includes("%%EOF");
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const detected = pdf ? "application/pdf" : png ? "image/png" : jpg ? "image/jpeg" : null;
  if (!detected || mime !== detected || !(pdf ? /\.pdf$/i : png ? /\.png$/i : /\.jpe?g$/i).test(name)) throw new EnrollmentError("The file content does not match its type. Choose a PDF, JPG or PNG.");
  if (kind === "photo" && pdf) throw new EnrollmentError("Use a JPG or PNG for your profile photo.");
  if (pdf && /\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA)\b/i.test(bytes.toString("latin1"))) throw new EnrollmentError("Use a plain PDF without scripts or embedded files.");
  return detected;
}
