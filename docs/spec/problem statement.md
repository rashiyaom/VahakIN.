# VahakIN | Problem statement and product requirements

**Specification:** IG-PS-01 · Revision 2.2 · 25 November 2026  
**Status:** SFIC prototype requirements; not an approved government deployment  
**Related documents:** [Architecture](architecture.md) · [Hardware](harware.md) · [Database](database.md) · [Implementation](implementation.md)

## 1. Purpose and authority

VahakIN is a proposed GPS-based monitoring and regulatory decision-support platform for vehicles officially declared **Non Use**. It enables vehicle owners and authorised transport department personnel to observe vehicle location, identify potentially unauthorised use and review evidence throughout an approved Non-Use period. It is not a conventional fleet management product, a government vehicle yard tracker, a replacement for VAHAN or an automated enforcement authority.

This specification supersedes the original yard-centric VahakIN concept where it conflicts with the actual challenge. Requirements marked **Official** are derived from the problem statement supplied by the team; **MVP** denotes our proposed implementation needed to demonstrate the outcome; **Later** denotes a proposed extension; **Open** requires clarification. MUST/SHOULD/MAY are design obligations for our implementation, not quotations of government mandates.

## 2. Competition and problem provider

| Field | Value |
|---|---|
| Competition | Seva First Innovation Challenge 2026 (SFIC), Gujarat |
| Initiative | Education Department, Government of Gujarat / SSIP 2.0 (as identified in team synopsis) |
| Problem ID | PS000225 |
| Official title | GPS system for non use vehicles |
| Problem provider | Collector Office -Rajkot |
| Sector | Fintech |
| Official users | Vehicle owners and RTO Department |
| Resource person email | rajkotdeo@gmail.com |
| Team institution | CSPIT, CHARUSAT University |
| Team reference | TM002281, from original synopsis |
| Proposed product | VahakIN — Intelligent Non-Use Vehicle Compliance System |
| Pilot scope | Rajkot RTO demonstration; actual pilot requires approval |
| Scale objective | Configurable multi-RTO, state and national oversight; not an official SFIC requirement |

### 2.1 Official problem, faithfully restated

The supplied official listing describes difficulty monitoring vehicles declared Non Use in real time. It highlights potential unauthorised usage by owners, drivers, family members or others, illegal operation to avoid applicable vehicle taxes, and risks of RTO penalties, tax liabilities and accident-related legal complications. An effective GPS-based monitoring mechanism to verify location and detect misuse is missing.

The expected outcome is that owners can know their vehicle's location and check that it is not being operated by unauthorised persons, while the RTO can monitor whether owners misuse vehicles declared Non Use. The intended impact is stopping misuse and preventing illegal operations. Those are desired outcomes, not proof that tracking by itself eliminates all violations.

### 2.2 Correct interpretation of Non Use

A vehicle declared Non Use is subject to an applicable official declaration process and conditions. Non Use is not synonymous with an abandoned, seized, impounded or government-owned vehicle. Owners may suspend operations for reasons such as business inactivity or repairs, subject to the actual applicable rules. Some declarations may affect vehicle tax obligations; exact eligibility, applicable taxes, periods and permissible movement depend on official rules and must not be invented.

Vehicles may be stored at owners' residences, private garages, transport depots, warehouses or other permitted premises. A common parking yard may exist but is not guaranteed. The platform must therefore support dispersed vehicles without requiring a single local LoRa gateway or a permanently present owner's phone.

### 2.3 Why Fintech

The technical mechanism is location monitoring; the regulatory and financial objective is detecting potential misuse of tax-related Non-Use declarations. A vehicle owner could improperly continue operating a vehicle while claiming relief from applicable tax, potentially leading to revenue leakage and unfair commercial advantage. Genuine owners may also face financial or legal complications if others operate their vehicle without permission. This explains the likely Fintech classification (an interpretation, not an official organiser explanation).

VahakIN supports evidence-led review. It does not prove commercial profit, tax liability, theft, identity of a driver or intent solely from movement. The product must never label a person a fraudster automatically.

## 3. Stakeholders and jobs to be done

| Stakeholder | Need | Access boundary |
|---|---|---|
| Vehicle owner | Know latest location, receive warnings, see declaration and evidence, report misuse | Own verified vehicles and appropriate incident information only |
| RTO registration operator | Enrol/import vehicle, owner and declaration; arrange device assignment | Assigned office and delegated actions |
| RTO enforcement officer | Monitor assigned vehicles, triage alerts, review journeys, collect evidence | Assigned office and cases, subject to permissions |
| RTO manager | Supervise workload, review investigations and authorise monitoring actions | Assigned office; maker/checker rules |
| RTO office administrator | Manage office users, devices, enrolment and operational policies | Assigned office; no self-promotion |
| State administrator | Review state-wide RTO performance and escalations | Assigned state/UT, appropriate data scope |
| National administrator | Aggregate oversight, cross-state policies and hierarchy | Authorised nationwide aggregate scope; case-level access only when explicitly granted |
| Technical administrator | Device health, provisioning, firmware, reliability | Technical metadata; no blanket access to owner/location data |
| Government finance/transport authority | Assess suspected revenue leakage and programme effectiveness | Authorised reports, official tax rules, human determinations |
| SFIC jury | Assess feasibility, relevance, innovation, affordability and demo evidence | Synthetic demo records and authorised test data |

The actual job titles, delegation model and authority to approve monitoring or investigations must be confirmed by the problem provider. “National Admin” is a proposed software role, not a claim of an existing MoRTH post.

## 4. User journeys and lifecycle

### 4.1 Enrolment and activation

1. An owner follows the applicable official Non-Use procedure outside VahakIN, unless a future approved integration allows it within the platform.
2. An authorised office operator searches for or enters vehicle registration details, verifies the owner and records the official declaration reference, effective dates and verification source.
3. The officer records a declared parking position and proposed permitted boundary, if required by the official process. A map preview allows confirmation of coordinate precision.
4. A provisioned monitoring device is assigned to one vehicle and declaration with a recorded installation date, initial location, seal identifier and installation checklist.
5. A manager reviews the registration/assignment and approves monitoring activation. Activation is not an approval of tax relief unless an official integration explicitly authorises that action.
6. The owner account is linked only after identity/ownership verification. Both office and owner can view the same monitoring facts with appropriate disclosure.
7. Once activated, a record appears in the office view and rolls up into authorised state/national views without duplicate registration.

### 4.2 Normal monitoring

A stationary vehicle is monitored for motion, location verification and device health. Periodic heartbeats identify whether the monitoring path is working. When location is available, record the fix time and accuracy indicators. Do not infer continued compliance solely from absence of events. Dashboard statuses must clearly distinguish recent observed evidence, stale location, missing communication and unknown motion state.

### 4.3 Suspicious activity and resolution

1. The device observes motion or tamper and records an event. It attempts communication and obtains a fresh location when feasible.
2. The backend authenticates, validates and deduplicates the event; stores the original evidence; compares active declaration and authorisation rules at event time.
3. GPS uncertainty, motion duration and supporting evidence are evaluated. A suspicious event may open an alert and, if appropriate, an investigation. A small bump or invalid fix alone is not a violation.
4. Notify the owner and relevant officer according to policy. Notifications must include observation time, freshness, vehicle reference and a link to review, not a definitive accusation.
5. The officer acknowledges, assigns, investigates and requests owner explanation where appropriate. Record evidence, policy version, findings and reasons.
6. A reviewer may dismiss, confirm an observed movement, refer a case to the official enforcement process, or mark it inconclusive. Only authorised officials can determine legal consequences through the applicable procedures.
7. Preserve the history of decisions; do not overwrite original events when a case is closed.

### 4.4 Completion and reuse

On official expiry or authorised termination, stop active monitoring for that declaration according to the approved policy, close the assignment, preserve historical evidence under retention rules and recover the device. Inspect seals and hardware, recharge safely, securely reset the device and rotate credentials before assigning it to another vehicle. Unsent events from the prior assignment must not be misattributed to the next owner. Post-period observations are not classified as Non-Use violations.

## 5. Functional requirements and traceability

| ID | Priority | Requirement | Acceptance outcome |
|---|---|---|---|
| FR-01 | MVP | Office-scoped vehicle and verified owner registry | One vehicle registered once; no cross-office duplicate ownership assumptions |
| FR-02 | MVP | Non-Use declaration lifecycle | Effective start/end, reference, status and approval recorded; no overlapping active declaration |
| FR-03 | Official/MVP | GPS monitoring | Real valid GPS fix appears on permitted map with source and timestamp |
| FR-04 | MVP | Declared location / optional geofence | Operator sets boundary; version recorded; uncertainty handled |
| FR-05 | Official/MVP | Potential unauthorised movement detection | Actual movement produces evidence and appropriate alert |
| FR-06 | MVP | Journey history | Depart-return journey remains visible even after return |
| FR-07 | MVP | Monitoring availability | Missing heartbeat results in unavailable/stale rather than compliant |
| FR-08 | MVP | Device registration and assignment | Provisioned device uniquely linked to active vehicle/declaration |
| FR-09 | MVP | Enclosure and mounting tamper | Each input creates distinct event; suspected interference flag |
| FR-10 | Official/MVP | Owner portal | Owner sees own vehicle, latest fix, declaration and alerts |
| FR-11 | Official/MVP | RTO portal | Officer monitors authorised office records and reviews incidents |
| FR-12 | MVP | National/state/office hierarchy | Authorised scope rolls up from office; cross-scope access denied |
| FR-13 | MVP | Evidence and audit | Append original observation; trace actions, actor, policy and result |
| FR-14 | MVP | Offline recovery | Retry and deduplicate; preserve event time; never silently discard data |
| FR-15 | MVP | Notification centre | Persist alert and delivery status; separate read and acknowledgement |
| FR-16 | MVP | Secure access | Device authentication, human RBAC and jurisdiction checks |
| FR-17 | MVP | Manual review and owner explanation | Officer can record outcome without altering evidence |
| FR-18 | Later | Movement authorisation | Only officially permitted movement with verifiable scope and expiry |
| FR-19 | Later | Financial estimation | Versioned, verified rules; no automated tax penalty |
| FR-20 | Later | Official VAHAN data access | Authorised credentials, minimal fields, provenance, freshness |
| FR-21 | Later | Reusable device programme | Return, inspection, sanitisation and reassignment records |
| FR-22 | Later | ML motion classification | Demonstrate improvement over rules on held-out vehicle/session data |
| FR-23 | Later | OTA and remote configuration | Signed release, rollback, asynchronous acknowledgement |
| FR-24 | Later | State-specific policy management | Versioned policies effective by jurisdiction and dates |
| FR-25 | MVP | Exportable case report | Authorised PDF/CSV contains source, times, uncertainty and review result |

P0 = core demo above; P1 = reliability and government-operational improvements; P2 = advanced differentiation. P0 includes the national/state hierarchy in schema and basic demo views, not nationwide deployment or live data from real RTOs.

## 6. Compliance state model

Track independent axes, not one misleading status field.

- **Declaration:** draft, pending_review, approved, active, expired, terminated, rejected. Effective time and official source determine whether monitoring is legally in scope.
- **Monitoring:** unassigned, healthy, delayed, unavailable, retired. Health derives from scheduled heartbeat deadlines, not a fixed universal threshold.
- **Location:** valid, uncertain, stale, unavailable. Include observed time, received time and available quality indicators.
- **Activity:** stationary_observed, minor_disturbance, movement_suspected, movement_observed, unknown.
- **Case:** open, acknowledged, investigating, awaiting_explanation, resolved, dismissed, referred.

An operator-friendly label may be derived from these independent axes: observed compliant, review required, suspected violation, suspected tamper, authorised movement, monitoring unavailable or monitoring ended. A stale/offline device can retain an open historical incident; the current location remains unknown. Do not collapse availability and guilt into one status.

## 7. Test scenarios and expected behaviour

| Scenario | Required behaviour |
|---|---|
| Vehicle stationary | Scheduled checks; latest valid fix with time; no false violation |
| Accidental bump | Log relevant observation; no tax violation from vibration alone |
| GPS drift at boundary | Apply quality, hysteresis and repeated fix checks; mark uncertain if needed |
| Vehicle drives away | Motion starts; new valid fixes show displacement; alert if active declaration and no applicable authorisation |
| Vehicle leaves and returns | Preserve entire observed journey and times; do not erase because current location matches |
| Driver uses without owner's consent | Same movement evidence; owner can report unauthorised use |
| Towing / relocation | Detect movement; distinguish cause only when evidence supports; allow official review |
| Approved relocation | Record authorisation snapshot and validate scope/time; no automatic accusation |
| Device case opened | Separate case-tamper event, even if GPS unavailable |
| Device detached | Mounting-tamper event; do not trust device position as vehicle position until reverified |
| Device removed without switch evidence | Missed heartbeat or inconsistency can flag review; bypass is a residual risk |
| Network outage | Local queue, delayed delivery, stale status, original timestamps |
| GPS unavailable indoors | Continue motion/health evidence, last fix labelled stale; no invented coordinates |
| Low battery | Warn and record monitoring limitations; controlled cutoff protects battery |
| Duplicate / reordered telemetry | Idempotent ingestion; correct event time ordering; no duplicate case from same event |
| Monitoring end | Stop prospective compliance evaluation; retain authorised historical review |
| Cross-office attempted access | Deny without leaking record existence; audit appropriately |
| Old device event after reassignment | Attribute only to original assignment if authenticated and eligible; never to new owner |

## 8. Non-functional requirements and measures

| Area | Proposed MVP / engineering goal (not official or proven) |
|---|---|
| Location | Valid fixes in open sky, target ~10–20 m with suitable signal; no indoor guarantee |
| Event latency | Measure event-to-server and event-to-UI separately; target under 30 s on working network after detection, GNSS fix time reported separately |
| Detection | Aim ≥95% recall on representative labelled significant movement tests; report sample size and confidence |
| False alarms | Measure alerts per stationary vehicle-day; proposed ≤1 false alarm per 30 vehicle-days needs long observation |
| Availability | Report observed heartbeat availability and gap durations; no claim of continuous tracking in outages |
| Data recovery | Recover all retained events in scripted outage tests; explicitly report queue overflow |
| Privacy | Least privilege; authorised monitoring period; minimise PII and exact locations at aggregate levels |
| Security | Reject replay/forgery, isolate tenants, signed releases when OTA enabled |
| Scale | Demonstrate multiple synthetic offices and load test; set nationwide capacity after measurements |
| Accessibility | Responsive UI, keyboard navigation, labels, text not colour alone; target WCAG 2.2 AA practices |
| Cost | Track hardware, SIM, hosting, installation, maintenance, reuse and replacement; no unverified price or battery claims |
| Reliability | Power testing, thermal constraints, network and sensor failures handled explicitly |

## 9. Financial model and scope boundaries

The proposed reusable-device programme may reduce cost per declaration by sharing hardware across sequential monitoring cycles. Hardware allocation = device acquisition cost / successful usable cycles; add connectivity, installation/removal, refurbishment, replacement reserve, hosting and administrative costs. A ₹1,800 device reused ten times would allocate ₹180 hardware per cycle only; this is illustrative, not a supplier quote or rental policy.

Revenue analytics must separate suspected exposure, reviewed exposure, official assessed liability and confirmed recovery. No real calculation until applicable tax schedules, exemptions, effective dates and assessment procedures are verified. Never extrapolate from synthetic incidents as actual recovered revenue.

Out of scope for MVP: fuel-cap sensing, seized-vehicle yard management, engine immobilisation, surveillance cameras, automatic penalties, driving licence checks, payment collection, scraping vehicle databases, claiming government endorsement, and any attempt to monitor beyond authorised periods. LoRa may be a future optional transport for concentrated yards but is not the nationwide baseline.

## 10. Open decisions and stakeholder interview

- Which vehicle classes qualify, how many declarations are active, and typical duration/parking arrangements?
- Is a specific parking location legally required? What movement and relocation exceptions are allowed?
- How quickly must owner/RTO receive an alert? What is the minimum location verification frequency?
- Does a vehicle already have a compatible approved tracking device? Can that data be reused?
- Who pays, installs, audits, charges, recovers and maintains devices? What cost ceiling applies?
- What evidence is acceptable for administrative review? What appeal or correction process applies?
- Is authorised VAHAN/Non-Use/tax API or sandbox access available? What data fields are permitted?
- What privacy, retention, hosting, data-sharing, certification (including applicability of AIS-140), and accessibility requirements apply?
- What officers, jurisdictions and permissions correspond to the actual administrative process?
- How should coverage gaps and monitoring interruptions be handled? What fallback communications are acceptable?

## 11. Source and revision notes

- Primary source: user-supplied official PS000225 text (`Pasted markdown.md`), including title, problem description, users, outcomes, impact and resource email. Public reference: [SFIC listing](https://www.sfic.co.in/problem_statement.php).
- Context: `VahakIN_SFIC_2026_Concept.pdf` is an earlier team concept, not authoritative where inconsistent with PS000225. Earlier procurement guides are superseded for current prototype inventory by [harware.md](harware.md).
- Proposed nationwide hierarchy, geofences, workflows, risk scoring, thresholds and reusable model are engineering recommendations; confirm with RTO before deployment.
