# Tax & Compliance Intelligence — implementation and validation

## Delivered scope and architecture decision

The working application uses Next.js server routes, the existing session cookie and jurisdiction policy, and a shared local demonstration store. The documented FastAPI, Supabase and PostgreSQL architecture has not yet been implemented: those backend directories are scaffolding. This feature extends the working services rather than adding a second backend or duplicating authentication, investigations or financial records.

Tax Review is an extension of the existing investigation, linked to its vehicle and declaration. All ten roles retain their existing identifiers and workspaces. Owners, officers, managers, RTO reviewers, auditors and aggregate dashboards consume the same records. Visible pages refresh every 15 seconds and on focus; successful actions refresh immediately. This is polling, not a production event subscription.

The UI reuses `WorkspacePrimitives`, including the same `SummaryMetrics` used on the RTO overview, existing panels, tables, badges, dialogs, forms and buttons. It uses the current RTO blue/charcoal/lime dashboard tokens; the homepage keeps its established public-site palette. This follows the user's latest instruction over the attachment's earlier sage dashboard description.

**This is a working DEMO implementation, not a production taxation service.** MANUAL and OFFICIAL writes fail closed. The user can complete simulated investigation, calculation, owner response, independent decision, demand, reconciliation and appeal-reference workflows. Government issuance, collection, live identity, legally verified tax schedules and legal translations remain unavailable.

## Workflow and consistency

1. One credible simulated movement event can open or join a Tax Review. GPS drift, missing signals and tampering do not establish liability. Operational GPS quality and geofence thresholds are not statutory thresholds.
2. Original events remain preserved; evidence records carry original-event SHA-256 hashes, recorded timestamps, available GPS fixes and explicit unavailable sensor fields. Routes are schematics of recorded fixes, not inferred road journeys. Distances are straight-line displacement, not odometer distance.
3. An assigned investigator records reasoned evidence dispositions. Preliminary proposals select the evidence and assessable period explicitly.
4. A separate reviewer can return a proposal, submit it for a decision, and disclose an estimate. Owners can upload supporting documents, explain towing/repair/device concerns, dispute observations, or give permission references. Responses receive timestamps and acknowledgement IDs.
5. A DEMO decision requires separately scoped authority, independent proposal review, an owner explanation request, and consideration of submitted responses. Silence never approves an assessment.
6. A demand requires an approved assessment and an independent authorized issuer. Drafts are not payable. Receipt reconciliation requires a separate permission and scoped authorization. Provider references and request UUIDs prevent duplicates.
7. Revisions preserve original calculations and rule snapshots. Superseded proposals are excluded from exposure; approved amounts remain until explicitly superseded or cancelled. Issued demands cannot be silently amended. Cancellation removes outstanding assessed dues while retaining cash receipt history.
8. Appeals are references to externally recorded proceedings; stay status is separate. There is no fabricated appeal submission or real payment gateway.

Local mutations use a cross-process filesystem lock and atomic replacement. Failed transactions do not commit. This is appropriate for the single-machine demo, not a replacement for production database transactions. A process crash may require an operator to inspect and remove a stale local lock directory.

## Calculation methodology

The reusable calculator is `apps/web/lib/tax/calculator.ts`. Monetary values are integer paise; decimal input is parsed exactly with BigInt and checked against safe integer limits. There is no floating-point tax computation.

The synthetic fixed-period scenario assumes ₹6,000 base tax. Selecting the illustrative Section 18(1A) scenario adds twice that amount (₹12,000), producing ₹18,000. This is not an official rate. Distance and elapsed minutes never enter the calculation. Category, jurisdiction, mode, effective dates, explicit period and rule verification are validated. Missing rates or an unverified method prevent calculation. An overlapping Section 18(1) penalty is rejected. No unverified interest, exemption, payment credit or adjustment is invented.

Multiple events cannot create overlapping active assessments for the same vehicle/period. Revisions supersede prior proposals without changing their original snapshots. Evidence integrity and later matching permissions are rechecked before an authorized decision.

Financial projections separately report proposal exposure, approved demo base tax, approved demo penalty, matched demo receipts, outstanding issued demands, disputes, stays, cancellations and pending actions. They include monthly, category, RTO and ageing distributions and case-to-assessment conversion. Official recovered revenue is always zero in DEMO. Age buckets are reporting intervals, not statutory deadlines.

## Legal source registry and pending verification

| Source | Referenced provisions | Status |
| --- | --- | --- |
| [Motor Vehicles Tax Act source supplied in the specification](https://www.indiacode.nic.in/bitstream/123456789/4580/1/motorvehiclestaxact.pdf) | Sections 3, 18(1A), 18(1B), 14 | Current consolidated text, amendments, schedules and applicability pending legal verification |
| [Motor Vehicles Tax Rules source supplied in the specification](https://upload.indiacode.nic.in/showfile?actid=AC_GJ_66_317_00005_00005_1543661645124&filename=bombay_motor_vehicle_tax_rules-1959.pdf&type=rule) | Rule 5, Form NT, certification and recovery procedure | Current prescribed procedure and notification validity pending legal verification |

The official source retrieval attempts did not establish current notified rates or procedures. OFFICIAL registry entries therefore have null rates and pending verification. Only explicitly labelled synthetic DEMO entries are active. State staff may prepare drafts and independently submit them for verification; publication is disabled until a verified legal approval path exists. Gujarat entries cannot be applied to another state. Submitted declarations, operationally active records and certified Non-Use periods remain distinct; a classification correction does not certify a declaration.

No arbitrary response deadline, appeal deadline, notice template or statutory appointment is supplied. Gujarati legally reviewed translations remain pending; the current UI is English.

## Authorization

Every action requires an active account, action permission, allowed jurisdiction, relevant ownership or investigation assignment, workflow state and DEMO integration mode. Statutory decisions additionally require a separate scoped authorization. Aggregate national/state projections exclude case-level identities and GPS. Technical roles receive no tax projection; auditors are read-only and do not inherit export or raw GPS permission. Owners receive only disclosed case content and estimates.

The complete additional tax permission matrix is below. Existing registry/device permissions remain in `lib/permissions/access.ts`.

<!-- Generated permission matrix follows. -->

| Existing role | Tax permission suffixes (`tax.` prefix) |
| --- | --- |
| national_admin | `analytics.read`, `rules.read`, `reports.export` |
| state_admin | `analytics.read`, `rules.read`, `rules.draft`, `rules.review`, `reports.export` |
| rto_admin | `analytics.read`, `exposure.read`, `assessment.read`, `assessment.simulate`, `assessment.prepare`, `assessment.review`, `assessment.revise`, `case.assign`, `case.investigate`, `evidence.read`, `evidence.append`, `owner_response.review`, `notice.prepare`, `payment.read`, `rules.read`, `appeal.read`, `audit.read`, `reports.export` |
| rto_manager | `analytics.read`, `exposure.read`, `assessment.read`, `assessment.simulate`, `assessment.prepare`, `assessment.review`, `case.assign`, `case.investigate`, `evidence.read`, `evidence.append`, `owner_response.review`, `notice.prepare`, `payment.read`, `rules.read`, `appeal.read` |
| enforcement_officer | `exposure.read`, `assessment.read`, `assessment.simulate`, `case.investigate`, `evidence.read`, `evidence.append`, `owner_response.review`, `rules.read` |
| registration_operator | None; existing operational access only |
| device_technician | None; existing operational access only |
| technical_admin | None; existing operational access only |
| vehicle_owner | `assessment.read`, `evidence.read`, `owner_response.submit`, `payment.read`, `appeal.read` |
| auditor | `analytics.read`, `assessment.read`, `payment.read`, `rules.read`, `appeal.read`, `audit.read` |

An extra fictional demo account, `demo-tax-authority`, uses the **existing `rto_admin` role**, with explicit assessment-approval, notice-issuance and reconciliation permissions and a server-seeded Gujarat/GJ-03 DEMO authorization. It is not an eleventh role or a statutory appointment. Ordinary RTO admins have none of these final powers. No self-assignment endpoint is provided. The synthetic grant has explicit validity dates; expired grants fail authorization.

Registration operators submit classification corrections through the existing registry API. An independent authorized reviewer approves them. Pending duplicates and repeat approvals are rejected, with an audit trail. Classification verification in DEMO does not imply official registry verification.

## API contract

Existing authentication and same-origin mutation protection apply. Reads are `no-store`. Request IDs are actor-scoped UUID idempotency keys; replaying the same ID with different content fails. Standard errors are `{ "error": "reason" }` with authentication/permission/not-found/validation status codes.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/tax?state=all&office=all` | Permission-aware shared case, rule and financial projections. Rejects unauthorized scopes. |
| `GET /api/tax?export=csv&state=Gujarat&office=GJ-03` | Separately authorized, audit-recorded, formula-escaped DEMO financial CSV. |
| `POST /api/tax` JSON | Transactional workflow action. Common fields: `action`, UUID `requestId`, `caseId`, reason (10–4000 characters). |
| `POST /api/tax` multipart | `caseId`, `file`; private DEMO PDF/PNG/JPEG attachment, maximum 2 MB, magic-byte validation and SHA-256. |
| `GET /api/tax/documents/:id` | Rechecks current case/owner/document access; attachment-only download with no-sniff and sandbox headers. |
| `POST /api/workspace` | Existing registry actions plus `classify` and `approveClassification`. |

Tax actions and extra fields:

- `simulate`, `prepare`: `ruleId`, `periodStart`, `periodEnd`, `penalty` (`none`/`18(1A)`), optional `otherPenalty`, `evidenceIds`. Simulation saves no assessment. `revise` adds the existing `assessmentId`.
- `review`: `assessmentId`, optional boolean `return`. `approve`, `cancel`, `disclose`, `noticeDraft`: `assessmentId`.
- `assign`: `assignee`. `finding`, `requestResponse`, `dismiss`: common case fields.
- `evidenceReview`: `evidenceId`, `disposition` (`Relied upon`/`Inconclusive`/`Excluded`).
- `respond`: `kind`, optional `permissionReference`, owned `documentIds`. Returns `acknowledgementId`. `reviewResponse`: `responseId`.
- `noticeIssue`: `noticeId`. `reconcile`: `noticeId`, unique `reference`, decimal INR `amount`, reason/source reference.
- `appeal`: `assessmentId`, external `reference`, boolean `stay`, `stayReference` when applicable.
- `recordPermission`: existing `movementRequestId`, verified external `reference`; DEMO authority only. Owner-submitted references are not themselves authorization.
- `ruleDraft`: title, category, provision, schedule, notification, HTTPS source URL, effective dates, decimal rate and reason. `ruleReview`: `ruleId`. `rulePublish` always fails closed in this implementation.
- Registry `classify`: `vehicleId`, reason `text`, `fields` containing classification, laden/unladen weight, seating, permit category and certificate reference. `approveClassification`: correction `id` and review reason `text`.

Source files are the definitive schemas and validation rules. The frontend calls these endpoints, including private documents; it does not write independent financial state.

## Demo walkthrough

1. Use the existing demo picker to enter **RTO administrator**. Open Financial Intelligence / Tax Review and the seeded v-003 case. Record a reasoned “Relied upon” evidence disposition.
2. As **RTO manager**, open that same case, calculate the labelled light-commercial DEMO scenario for the evidence date and save a proposal. A ₹6,000 base with potential 2× penalty produces ₹18,000.
3. As **RTO administrator**, independently review, disclose the estimate and request the owner explanation. Attempting a final decision as an ordinary RTO admin is denied.
4. As **vehicle owner**, open Compliance & Tax. Read disclosed evidence and calculation details. Submit an explanation and a small PDF/PNG/JPEG. Record the acknowledgement ID.
5. As the assigned **enforcement officer**, review that same response and supporting document. Return/exclude evidence if the explanation changes the finding; no automated guilt decision is made.
6. As **DEMO Taxation Authority**, record a reasoned simulated decision after the response has been considered.
7. As **manager**, prepare a demand draft. As **DEMO Taxation Authority**, issue the simulated demand and reconcile a clearly fictional receipt. Retrying the same payment reference does not add revenue twice.
8. Compare RTO, state, national and auditor financial views. An owner sees only their disclosed records. Technician and technical-admin tax requests return access denied.
9. For a no-liability outcome, use evidence review and dismissal before an active assessment exists; preserve the reason. For revisions/cancellations, inspect the previous unchanged snapshots and corrected summaries.

## Migration and production boundaries

`database/migrations/0010_tax_compliance.sql` is an **unapplied additive migration blueprint**. It requires the existing profiles, vehicles, declarations, incidents, device-events, states and RTO-office tables. Those foundational migrations are not present in this scaffold. The migration deliberately fails preflight rather than inventing a second registry. It defines normalized tax/evidence/response/notice/payment/appeal/audit records, integer-paise constraints, active-period exclusion, immutable-record triggers, payment locking, and default-deny RLS. PostgreSQL execution was not validated because no local PostgreSQL server/client or container runtime was available. It must be reviewed and integration-tested against the completed base schema; it is not deployment-ready as-is.

Production dependencies still required:

- Implement and integrate the documented FastAPI/PostgreSQL/Supabase services and identity model; deploy least-privilege field-level RLS/service policies. The SQL defaults to no public access, not a completed production policy layer.
- Verify current Gujarat law, category-specific rates, certified assessable periods, exemptions/credits, appointments, publication procedures, official notices and appeal instructions.
- Provide trusted MANUAL document/decision ingestion and OFFICIAL government/payment adapters. Neither is enabled by this prototype.
- Replace local simulator events with authenticated device ingestion, validated signing/replay handling and a production evidence-retention/legal-hold process. DEMO hashes are integrity checks, not a claim of legal admissibility or tamper-proof storage against host administrators.
- Configure encrypted storage, TLS, scanned private document storage, malware controls, retention/deletion policies and production access logging. Demo attachments are unscanned and served only as downloads.
- Add legally reviewed Gujarati strings and procedure-specific accessibility review. No machine translation is represented as legally reviewed.
- Notification updates are in-app chronology and polling; external email/SMS/push delivery, official service evidence and notification preferences are not integrated.
- The local simulator uses an explicitly illustrative fixed-period rule; additional real rate methodologies and verified financial adjustments require reviewed implementations. The rule registry cannot publish production rules yet.

## Validation

Automated checks cover exact paise, unknown rates, state/category/date isolation, prohibited overlapping penalties, one-event review, drift/tamper/gaps, permission matching, owner documents, independent approval, silence, role isolation, preserved snapshots, revisions, cancellation, idempotency and hash chains. Browser tests exercise shared records across roles, concurrent demand/payment requests, classification approval, existing dashboard sections, homepage behavior and mobile overflow. Validation completed on 26 November 2026: 57 unit tests passed; all 16 browser tests passed; TypeScript and the optimized production build passed. A follow-up browser test checks the shared tax-screen Refresh and Export controls. Browser runs used an isolated temporary DEMO store, preserving the user workspace data.

## Source map

- `apps/web/lib/tax/{types,calculator}.ts`: shared types and monetary rules.
- `apps/web/lib/server/tax-service.ts`: evidence, workflow, authorization, financial projections and document access.
- Existing `demo-store.ts`, `telemetry.ts`, `session.ts`, `workspace.ts`, and permission policy: shared state, ingestion, transactions, registry projections and access control.
- `apps/web/app/api/tax/route.ts`, `api/tax/documents/[id]/route.ts`: tax and private-document APIs.
- Existing session/workspace API routes: serialized mutations and classification correction workflow.
- `apps/web/components/dashboard/{Dashboard,TaxWorkspace,WorkspacePrimitives}.tsx`: integrated existing dashboard and shared controls.
- Existing demo picker and homepage components: explicit authority persona and public explanation.
- `apps/web/styles/tax-compliance.css`, `app/layout.tsx`: responsive tax-specific layout using established dashboard tokens.
- `apps/web/tests/unit/tax.test.ts`, `tests/e2e/tax-workflow.spec.ts`: regression coverage.
- `database/migrations/0010_tax_compliance.sql`: unapplied schema extension.
