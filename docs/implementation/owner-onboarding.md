# Owner onboarding and RTO review

Implemented for the Gujarat / Rajkot city **DEMO** pilot on 26 November 2026. The existing Next.js application, session system, permission checks and local transactional store are reused. No government filing, identity verification service, production database connection or hardware connection is implied.

## Try the complete journey

1. Open `/login/owner` and choose **Start new owner setup · demo**, or choose **New vehicle owner** at `/demo`. This creates a fresh fictional applicant and sample device inventory entry. Owners without a verified vehicle are directed to `/owner/onboarding` after sign-in and when visiting the owner workspace.
2. Use the displayed sample device ID and activation code. Claiming reserves it for the application. The separately labelled demo connection check records a setup heartbeat only.
3. Complete six short steps: device, applicant, vehicle/tax record, parking/dates, documents, review. Continue and Save draft persist progress. Returning to owner sign-in with an existing owner session resumes the appropriate workspace. Unsaved edits trigger a browser unload warning.
4. Upload sample PDF/JPEG/PNG files (5 MB each). Profile photos are optional; required documents depend on vehicle category, applicant capacity and incident reason. The review page provides editable summaries and an acknowledgment before submission.
5. Submission validates the entire package on the server, assigns GJ-03 using the pilot parking service area, records a frozen revision and delivers it to `/gov/applications`. It does **not** create a verified vehicle record yet.
6. Use `/demo` to enter the RTO administrator workspace. Open Applications. Begin review, request specific corrections, reject with a reason, or approve after checking the four evidence/jurisdiction confirmations. Only the responsible office can view a submitted package; only authorized RTO reviewers can decide.
7. To return to the applicant after switching roles, use **Pick up where you left off** at `/demo`. The eight most recent fictional applicant identities are available there. This intentionally shared demo facility is not production authentication. A different browser context can also retain an independent owner session during review.
8. Requested corrections reopen the form. The officer continues seeing the last submitted fields and evidence until the owner resubmits. Previous packages and decision notes remain available.
9. Approval atomically creates the linked owner/vehicle/device registry record. The owner gains access to that vehicle. Installation remains pending. A reviewer can record a demo installation after a recent simulated setup check; this moves the record to **Verified · monitoring pending**, with no fabricated GPS fixes, heartbeat, tax relief or official declaration status.

## Research and form policy

The [India Code government-hosted rules compilation](https://upload.indiacode.nic.in/showfile?actid=AC_GJ_66_317_00005_00005_1543661645124&filename=bombay_motor_vehicle_tax_rules-1959.pdf&type=rule), modified through 11 January 2007, contains Rule 5 and Form NT. They inform the identity/capacity, registration, tax history, requested period, garage address, reason and signed-undertaking fields. Rule 5 identifies the authority for the place of Non-Use and refers to taxation and transport-vehicle fitness evidence. This is a historical official source, not confirmation of the complete current procedure.

The [Supreme Court judgment hosted by Gujarat High Court](https://gujarathighcourt.nic.in/hccms/sites/default/files/scgujaratijudgments/eng/CA_6462_of_2001.pdf) also reproduces the amended Rule 5 and discusses the distinction between declaration and certification. It supports keeping review, monitoring and tax outcomes separate.

RC and representative-authority uploads are **VahakIN verification requirements**. Photo, email and parking coordinates are optional product fields. No mandatory Aadhaar, biometric verification, current statutory fee, processing deadline or tax entitlement is asserted. Signed Form NT is uploaded; the application checkbox does not substitute for a legal signature. Supporting evidence is requested for incident-based applications as a pilot completeness rule.

The rules compilation has a financial-year note on Form NT while amended Rule 5 refers to the tax-paid period. The implementation flags financial-year crossings, periods exceeding stated tax payment and potentially late incident filings for authority review, rather than inventing a universal rejection rule or fee. Ordinary planned applications require a future start; incident cases collect an incident date and evidence. Current local instructions and acceptance of electronic copies still require participating-authority verification before live use.

Routing is a **versioned pilot service-area mapping**, not a GPS nearest-neighbour calculation or an authoritative boundary dataset. Only Rajkot city is enabled. Other districts and uncertain/outside-city parking are blocked with an assisted-routing message. The server derives the office and the reviewer explicitly confirms jurisdiction. Registering office, residence and current GPS cannot override this mapping. Add verified service areas to `lib/enrollment/policy.ts` before expanding coverage.

## Persistence and endpoints

`lib/enrollment/types.ts` defines applications, fields, immutable submission revisions, document metadata, history and device reservations. `lib/server/enrollment.ts` implements the state machine. The existing `.data/vahakin-demo.json` contains the new `enrollment` object; uploads live outside the public tree under `.data/onboarding-files/` with random storage keys and restrictive file permissions. Both locations are ignored by Git. Claims store activation-code hashes, separate from hardware credentials; demo codes are intentionally shown on sample cards.

| Endpoint | Behavior |
| --- | --- |
| `POST /api/session`, mode `new-owner` | Create a fictional applicant, provision a sample device and establish a normal HttpOnly demo session. Production demo-disable gate remains in force. |
| `GET /api/applications` | Return the caller's own applications or submitted applications within the permitted office. No private credential fields. |
| `POST /api/applications` | `start`, `save`, `claim`, `release`, `remove-document`, `submit`, `review`, `demo-setup`, `demo-install`. Mutations require same origin, active session, ownership/permission, lifecycle eligibility and optimistic version. |
| `POST /api/applications/documents` | Bounded multipart upload: `id`, `version`, `kind`, `file`. Validate size, extension, MIME and basic file signatures; reject obvious active-PDF constructs. Replacement preserves submitted evidence and resets the acknowledgment. |
| `GET /api/applications/documents/:id` | Recheck application access; return attachment with no-store, no-sniff and sandbox headers. No public file URLs. |

Reviewer actions require `applications.review`; scoped read access uses `applications.read`. Owners cannot approve themselves. Other owners, other offices, aggregate roles and technical roles cannot read these application packages. Staff cannot inspect unsubmitted drafts or newly edited correction content. Approval checks registration/device uniqueness under the store lock. Duplicate successful submissions are idempotent; stale edits and repeated decisions return conflicts. Device activation attempts are limited per account. Files have SHA-256 metadata and upload audit events; revisions retain exact document IDs.

## Validation

- Unit tests cover claims, duplicate registrations, missing evidence, draft/office/owner isolation, optimistic concurrency, immutable corrections, independent approval, pending installation/monitoring, calendar dates, conditional requirements and file validation.
- Browser tests complete the owner → RTO corrections → resubmission → approval → installation journey, verify private downloads, resume drafts, check mobile light/dark layouts and exercise API denials.
- Existing workspace, tax, theme and review regressions remain applicable. Run `npm run typecheck`, `npm test -- tests/unit`, and `VAHAKIN_TEST_URL=http://localhost:3001 npx playwright test tests/e2e/enrollment.spec.ts` against a running local preview. Use `localhost`, matching the current session module's origin validation.

## Production integration still required

The demo is deliberately disabled by default in production and its personas are shared test identities. Real sign-up / OTP / account recovery, durable PostgreSQL migrations and repository adapters, verified office boundaries, private object storage with malware scanning, retention jobs, official reference verification and authenticated hardware ingestion are not implemented by this change. The signature checks are not a PDF parser or malware scanner.

For the production database, preserve the application/revision/document/history separation and transactional invariants when mapping to profiles, devices, vehicles, effective-dated ownerships, declarations and device assignments in `docs/spec/database.md`. Pending applicants must remain distinct from verified vehicle access. Replace local files with scoped object-storage references and keep atomic approval plus durable notification/outbox delivery. Device claims establish possession of a separate activation code, never the right to submit telemetry using a device number alone.

No real RTO email, SMS, VAHAN write, payment or external notification is sent. The functional handoff in this implementation is the shared in-app RTO queue. The current local JSON store and sample hardware must not be used with real owner information.
