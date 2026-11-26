# VahakIN | End-to-end implementation plan and engineering playbook

**Specification:** IG-IMP-05 · Revision 2.2 · 25 November 2026  
**Status:** Implementation instructions, not a claim that features have been built  
**Companion specifications:** [Problem statement](problem%20statement.md) · [Architecture](architecture.md) · [Hardware](harware.md) · [Database](database.md)

## 1. Project execution philosophy

Build for India, demonstrate for Rajkot. Deliver a working end-to-end monitoring flow before building every dashboard or advanced ML feature. Website development can begin immediately with a deterministic device simulator and fictional transport records. Integrate real ESP32-S3 telemetry via the same API once hardware is ready. Reuse owned ESP32-S3, MPU6050 and SIM800L; purchase NEO-6M and validated supporting hardware. Do not block software on official API access or 2G compatibility. Use ESP32 Wi-Fi as the first secure hardware transport; if SIM800L cannot support secure connectivity, disclose that limitation and retain the working prototype. Nationwide deployment and real regulatory enforcement are future approved activities.

### 1.1 Definition of done

A feature is done only when its UI, backend, database constraints, access policy, empty/error/loading states, tests and documentation work together. Mock functionality must be labelled. No fabricated GPS, government verification, AI score, tax savings, battery duration or official approval. Do not create clickable but inert controls. Keep unresolved feature paths hidden or explicitly labelled planned. Every phase has an acceptance gate; do not proceed to unsafe electrical tests merely to meet a software deadline.

## 2. MVP scope versus extensions

| Capability | P0: required working demo | P1: reliability / pilot preparation | P2: advanced |
|---|---|---|---|
| Website | Public landing + govt/owner login, common portal shell | Accessibility polish, translations | Additional public resources |
| Hierarchy | National/state/office scopes and aggregate views, local operator/manager/officer roles | Delegated cross-office cases, refined policies | Multi-state production deployment |
| Registry | Manual/demo enrolment, verification source, owner link | Official adapter readiness | Approved VAHAN synchronisation |
| Declarations | Effective period, review, active/expiry, assignment | Authorised relocation workflow | Official workflow integration |
| Monitoring | Map/list, latest fix, history, stale/unknown, heartbeat | Geofence polygon, richer journey quality | State-wide analytics at scale |
| Device | Real Wi-Fi event, simulator, unique ID, assignment | Secure cellular after test, sleep, power validation | 4G custom PCB, OTA, production certification |
| Compliance | Rule-based movement/tamper alert, case and owner response | Repeated journey risk, investigation exports | Trained ML/anomaly model, verified tax estimates |
| Security | JWT/RBAC/scope, device HMAC/TLS, audit, idempotent queue | MFA, backups, evidence anchoring evaluation | Government SSO and compliance review |
| Operations | In-app alerts, device health, CSV/PDF case export | Push/email, reuse flow, monitoring runbook | Rental model and financial ledger subject to approval |

Core demo acceptance: one physical/test vehicle registered at Rajkot, approved monitoring record, real or explicitly simulated movement evidence, scoped state/national totals, alert on owner and officer view, investigation and export; stale network and tamper handled. No need for real VAHAN credentials, live national data or actual tax penalties.

## 3. Repository and ownership

Use a monorepo with separate build processes. The five supplied MD documents belong under `docs/spec/` (keep their exact names or update links consistently).

```text
vahakin/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (public)/
│       │   ├── login/government/
│       │   ├── login/owner/
│       │   ├── gov/
│       │   ├── owner/
│       │   ├── ops/
│       │   └── auth/callback/
│       ├── components/{ui,layout,maps,charts,vehicles,alerts,devices}/
│       ├── features/{identity,registry,declarations,monitoring,cases}/
│       ├── lib/{api,auth,permissions,realtime,format,validation}/
│       ├── styles/
│       ├── tests/
│       └── package.json
├── services/
│   └── api/
│       ├── app/
│       │   ├── main.py
│       │   ├── core/{config,security,errors,logging,db}/
│       │   ├── api/v1/
│       │   ├── domains/{identity,jurisdictions,registry,declarations}/
│       │   ├── domains/{devices,ingestion,monitoring,geospatial}/
│       │   ├── domains/{compliance,cases,reports,notifications,audit}/
│       │   ├── integrations/{base,demo,manual,official}/
│       │   └── workers/
│       ├── tests/{unit,integration,security,contract}/
│       ├── pyproject.toml
│       └── Dockerfile
├── firmware/
│   ├── main/
│   ├── components/{board,power,imu,gnss,modem,tamper}/
│   ├── components/{clock,event_builder,queue,transport,security,config}/
│   ├── test/
│   ├── partitions.csv        # generated after actual board/build check
│   └── sdkconfig.defaults
├── packages/
│   ├── contracts/{telemetry-v1.schema.json,examples,test-vectors}/
│   └── api-client/           # generated typed web client
├── database/
│   ├── migrations/
│   ├── seed/demo/
│   ├── tests/
│   └── README.md
├── tools/
│   ├── simulator/
│   ├── provision-device/
│   ├── load-test/
│   └── dataset-tools/
├── ml/
│   ├── datasets/             # no private/raw data in Git
│   ├── features/
│   ├── training/
│   ├── evaluation/
│   └── export/
├── infra/{docker,deploy,monitoring}/
├── docs/{spec,adr,api,tests,demo}/
├── .github/workflows/
├── .env.example
├── .gitignore
└── README.md
```

Team workstreams: frontend/product; backend/database/security; hardware/firmware; data/ML/testing; integration/demo coordinator. Assign names in team tracker rather than inheriting inconsistent role ownership from old synopsis. A single contract owner approves telemetry/API changes. Use pull requests, short feature branches, review for migrations and auth/power changes, issues linked to FR IDs. Maintain ADRs for major decisions (transport fallback, access scope, auth, schema, policy versions).

## 4. Local environment setup

Install Git, a supported Node.js LTS, Python compatible with chosen FastAPI tooling, Docker, Supabase CLI (if local Supabase), ESP-IDF with exact board target, and USB serial driver if needed. Verify official package compatibility, pin dependencies with lockfiles, document exact versions. Do not install production dependencies globally unless required. On Mac/Windows/Linux keep project environment isolated.

Example bootstrap sequence after repository exists; commands are target workflow, not tested against a generated codebase:

```bash
git clone <your-repository-url> vahakin
cd vahakin
cp .env.example .env
# Start local Supabase or configured PostgreSQL/PostGIS + auth environment.
# Apply reviewed migrations and demo-only seeds.
# In apps/web: install locked dependencies, then run dev script.
# In services/api: create virtualenv, install locked dependencies, run FastAPI.
# Start outbox worker and simulator in separate terminals.
```

Environment variables:

| Key | Exposure | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Public | Browser API address |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Auth/realtime URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public, RLS required | Public client key; use project-specific publishable key if applicable |
| `DATABASE_URL` | Server only | Restricted DB connection |
| `SUPABASE_URL` | Server | Auth/JWKS/provider URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only, only where required | Privileged provisioning/worker operations, never browser |
| `DEVICE_SECRET_MASTER_KEY_REF` | Server only | Secret-store/encryption reference; not raw key in repo |
| `APP_ENV` | Server | `dev`, `demo`, `staging`, `production` |
| `TRANSPORT_RECORDS_MODE` | Server | `DEMO`, `MANUAL`, `OFFICIAL` (official disabled without approval) |
| `MAP_STYLE_URL` | Public if safe | Licensed tile style; restricted key where applicable |
| `ALLOWED_ORIGINS` | Server | Explicit frontend origins |
| `REPORT_BUCKET` | Server | Private report storage |
| `NOTIFICATION_MODE` | Server | In-app first, provider optional |
| `LOG_LEVEL` | Server | Redacted logging |

Use `.env.example` placeholders, ignore `.env*` except example, no real device credentials or SIM APN secrets in repo. For local physical device, `localhost` is the device itself; use an accessible development HTTPS endpoint and trusted certificate. Do not expose local privileged database to public internet. Demo/reset endpoint disabled outside demo environment and protected by tech role.

## 5. Phase 0 — Product foundation and contracts

**Deliverables:** agreed requirements, working repo, contract fixtures, design tokens and a risk register.

1. Freeze core user journeys: local enrolment, active declaration, device event, dashboard update, owner alert, investigation and export.
2. Confirm actual owned board models via photos; hardware team creates electrical checklist before connecting. Inventory remaining parts and budget; no duplicate A9G or SIM800L purchase.
3. Decide demo source conventions (`demo`, `simulator`, `test_hardware`) and all labels. Create fake states/offices/users and fictional vehicle records; no real owner data.
4. Define telemetry JSON schema, API error format, status enums, units, ID conventions, timestamp semantics and HMAC canonicalisation test vectors. Add examples for position, heartbeat, tamper, invalid GPS, delayed/offline and duplicate.
5. Define permission matrix and scope rules from Architecture; decide what P0 national/state views expose (aggregate only by default).
6. Establish project style, screen routes, responsive breakpoints, theme tokens, component conventions, test framework and CI.

**Gate 0:** contracts validated by automated fixtures; project builds locally; no conflicting definitions across frontend/backend/firmware; board-specific power design still explicitly conditional.

## 6. Phase 1 — Website foundation (start now)

### 6.1 Build UI shell and public site

- Next.js App Router + TypeScript; shared layouts for public, government, owner and restricted technical workspace. Use Tailwind CSS, shadcn/ui and Lucide; MapLibre and Recharts when pages need them.
- Public landing: premium institutional Indian design, concise explanation of problem, workflow and benefits; clear prototype/SFIC status; government/owner login CTAs. No official seals or claim of endorsement. Keep animation lightweight; reduced-motion support; mobile responsive.
- Implement shared components: scope selector/breadcrumb (only authorised choices), sidebar, top bar, search, metric cards, status badges, skeleton/empty/error states, table filters/pagination, dialogs, notification list, freshness labels, demo badge. Theme light/dark with accessible contrast and keyboard navigation.
- Create routes listed in Architecture. Implement P0 only; later route links omitted/disabled with explicit planned label. Use mock fixtures through typed API service boundary, not scattered hardcoded component data. No fake API fetch claiming government verification.

### 6.2 Authentication and authorisation

- Integrate Supabase Auth with separate government/owner UI entry points, same identity service. Government accounts invited by authorised admin; no public admin signup or role selection. For demo, provide clearly identified seeded accounts. Owner accounts linked after verification; implement OTP only if configured; otherwise secure test sign-in.
- Backend `/me` returns effective memberships, capabilities and permitted scope. Verify JWT signature, issuer, audience and expiry with official auth configuration. Query active membership to prevent stale privilege claims. Authorise every read/write by resource scope. Use server-side protection for routes and backend policy, not just UI hiding.
- National dashboard aggregates states; state aggregates offices; office admin manages local work; officer sees assigned or permitted records; operator registers; owner sees own vehicle. Technical admin limited to device/diagnostic data.

**Gate 1:** public pages work; role login routes correctly; unauthorised API and route tests deny other office/owner access; responsive on desktop/mobile; fictional demo data visibly labelled.

## 7. Phase 2 — Database, registry and declaration workflow

Migration order: extensions and private schemas → reference/identity tables → roles/permissions/memberships → vehicles/ownerships/history → declarations/geofences → devices/credentials/assignments → telemetry/fixes/projection/outbox/replay → journeys/alerts/incidents/evidence/notifications → audit/RLS/grants/indexes → optional tables and seeds. Supabase Auth identities created via supported admin API in test setup, not arbitrary insert into managed auth internals. Keep schema and RLS migration tested together; do not expose unprotected tables.

Implement P0 API modules and OpenAPI contract. Generate typed client or maintain verified DTO types. Forms must handle validation, duplicate records, conflicts, pending submission and retry. Use server-confirmed state after mutation rather than fake optimistic success.

### 7.1 Enrolment wizard

1. Source mode: demo/manual; official disabled until credentials. Search normalised registration.
2. Vehicle: registration number, class, optional make/model, responsible office derived from permitted scope.
3. Owner: verified relationship or pending link; minimal contact information.
4. Declaration: official reference if available, start/end, local monitoring status and source; confirm dates.
5. Location: map point/address, configurable circle boundary; map precision and no fabricated fix.
6. Device assignment: select available provisioned test device, record installation and seal; enforce one active assignment.
7. Review: submit to manager; approval activates monitoring only, not tax exemption. Record actions and audit.

State/national counts update from same canonical records. Test duplicate registration, invalid dates, overlapping declaration, assignment conflicts and expiry. Implement local office transfer only if needed; otherwise document unsupported workflow rather than overwriting history.

**Gate 2:** one enrolment creates correct DB relationships; manager approval works; counts roll up once; role constraints, transaction rollback and audit tested. A second office cannot access detailed record unless authorised.

## 8. Phase 3 — Simulator, ingestion and live website

Build simulator before physical integration so software can be tested without waiting for purchases. Python CLI/service uses the same signed HTTPS endpoint and telemetry schema as device firmware. Use separate demo keys, deterministic scenario seeds and explicit source kind. Do not fake a physical sensor if simulator is active. Add optional restricted demo control panel under `/ops` that triggers predefined scenarios only.

### 8.1 Simulator scenarios

| Scenario | Generated observations | Expected UI |
|---|---|---|
| parked | Valid position + heartbeat, no significant motion | Last verified location, observed stationary |
| bump | Short motion, no reliable displacement | Minor disturbance, not violation |
| drive | Sequence of valid GPS fixes outside geofence + motion | Journey, suspected movement alert |
| return | Journey ends at declared location | Historical incident remains |
| tamper_case | Case switch event | Distinct suspected tampering alert |
| tamper_mount | Mount switch event | Location association uncertain |
| no_fix | Heartbeat + invalid/no fix | Monitoring available, location unavailable/stale |
| outage | No transmission for configured deadline | Monitoring unavailable, no false compliance |
| recovery | Buffered events arrive late | Original time preserved, no duplicate alerts |
| duplicate | Replay same event IDs in new signed request | Duplicate ACK, no extra records |
| out_of_order | Older fix received after newer | History appended, current pin unchanged |
| low_battery | Voltage crosses configured threshold | Health warning, not tax violation |
| expiry | Observation after end date | No prospective Non-Use violation |
| invalid_signature | Wrong key/signature or replay | Rejected, audit/metric, no event stored |

Use a deterministic route near demo coordinates, not a real identified owner's home. Movement simulation can use synthetic geodesic steps; display observed polyline, not routed road path presented as actual travel.

### 8.2 Ingestion implementation checklist

- Validate body size and JSON schema before expensive work; verify TLS/HMAC, request freshness and request ID replay. Use constant-time signature compare, secure key store, per-device limits.
- Resolve assignment from authenticated device; check event's assignment, observation interval and source. Quarantine inconsistent old assignment, never auto-map to current owner.
- Validate units, coordinate range, timestamps, allowed types and metadata. Clock uncertainty explicit. Compute canonical per-event hash; dedupe stable IDs and reject conflicting payloads.
- Insert immutable event and outbox transactionally, ACK only after commit. Implement accepted/duplicates/rejected arrays; no ACK on failed transaction.
- Worker derives valid fix, heartbeat projection, motion classification, journey and alert. Use policy effective at event time, deterministic dedupe keys and idempotent handler. Lease/retry/dead-letter with metrics.
- On new projection, scoped realtime event updates UI; fallback polling, reconnect and canonical API reload. Clear caches on scope change; never subscribe to global raw table.

### 8.3 Map and dashboard

Implement viewport + list filters, clustering, valid fix pins, last-known grey/stale marker, approved circle, observed journey polyline and map attribution. Do not plot null coordinates. Show fix time, receipt time, age, speed if available, quality indicators and source. Do not infer accurate metres from HDOP alone. Use accessible table alternative. National/state views default aggregate, drill into offices only as permitted. Show data freshness on metrics; distinguish vehicles from incident counts.

**Gate 3:** signed simulated event reaches database → worker → map and alert UI; duplicate event creates no duplicate case; invalid signature rejected; stale/offline and invalid GPS visible; owner and local officer see permitted updates; cross-scope realtime test passes.

## 9. Phase 4 — Compliance rules, investigations and owner portal

### 9.1 Rule engine baseline

Define versioned thresholds in config (initial test values, not official rules): meaningful motion duration, quality acceptance, hysteresis, consecutive fixes, heartbeat grace and repeat journey window. Use robust handling of outliers and sensor/GPS confidence. Process observation-time declaration state; no active declaration -> store only if permitted, no Non-Use alert. For device detach, invalidate vehicle-location association until verified. Motion with no GPS = suspected activity/uncertainty, not proven geofence exit. Offline = monitoring unavailable, not automatically fraud.

Pseudocode:

```text
on accepted event:
  resolve historical assignment and declaration at observed time
  update monitoring health using server receipt independently
  preserve original observation and quality
  if invalid time or assignment: flag for verification; do not infer compliance
  if no applicable active declaration: do not generate prospective violation
  if tamper: alert suspected tamper; mark association uncertain if mount removed
  if significant motion: start/continue candidate journey
  if reliable fixes + approved boundary + sustained displacement:
      compare applicable authorisation; record movement evidence
      if unexplained: create idempotent suspected violation alert
  if stationary / minor disturbance: record without legal accusation
  if expected heartbeat missed: create one monitoring gap episode
  publish scoped projection and queued notifications
```

Use case statuses open → acknowledged → investigating → awaiting explanation (optional) → resolved/dismissed/referred. Service checks permitted transitions, actor and optimistic version. Preserve evidence and notes; append status actions and review reason. Owner can report unauthorised usage or submit explanation, not change raw events. Officer requests explanation; manager reviews. Export PDF/CSV with vehicle reference, declaration dates, event/fix/receipt timestamps, map/location quality, movement evidence, policy version, source, reviewer/outcome and limitations. Reports must not look like official fines or certificates.

### 9.2 Owner portal

Mobile-first dashboard, own vehicles, latest verified location, history, declaration expiry, alerts, incident response and device health. Alert text neutral: “Movement detected; review required,” not “Tax fraud confirmed.” Show unavailable if data stale. Owner account link verified; no ability to view other owners. Push/SMS optional; in-app notification works first and marks read independently of RTO acknowledgement.

### 9.3 Financial view

For MVP show counts of suspected incidents, cases reviewed, monitored periods and cost model assumptions. If showing revenue leakage demo, mark fictional rates and output, never actual loss or penalty. Future verified tax rule adapter, versioned calculations and official determination; optional reuse model cost per monitoring cycle. No automated payment or e-Challan submission.

**Gate 4:** driver/owner misuse scenario leads to alert, owner response, officer investigation and review report; approved/uncertain/expired scenarios handled; no evidence mutation or automatic penalty.

## 10. Phase 5 — Hardware integration (parallel from Phase 0)

Follow [harware.md](harware.md) gates H0–H12. Exact board models unknown; inspect before power, obtain lab supervisor review. Do not assume all ESP32-S3 boards expose same RTC pins or have 8 MB PSRAM. Do not power bare SIM800L at 5 V. Never run modem high-current branch through breadboard or USB converter without validated rating.

### 10.1 Bring-up sequence

1. Photograph all existing modules, acquire NEO-6M/switches and validated supporting components. Confirm battery/charger/logic translation conditional choices.
2. ESP32-S3 USB-only: flash minimal serial program, identify target and flash/PSRAM, log reset causes; map pins with board documentation. Set safe power control defaults.
3. MPU6050: I2C scanner, WHO_AM_I, calibration, six-axis readings, interrupt; verify wake source. Test each sensor separately before combined setup.
4. NEO-6M: UART baud/pinout, open-sky valid fix, NMEA parsing, timestamps, speed/HDOP, invalid/stale output. Verify supply and logic.
5. Tamper: two independent switches, debounce, polarity, enclosure/mount mock tests. Record event before network call. Test wake behaviour when released and held.
6. Wi-Fi: provision test device ID/key securely; obtain trusted time; send signed HTTPS heartbeat, position, motion and tamper events. Verify real hardware source badge and durable ACK. Use simulator only for clearly marked supplemental scenarios.
7. SIM800L: confirm exact carrier input/logic, antenna and compatible 2G SIM/APN; bench supply nominal 4 V for bare VBAT with transient capacity; measure voltage during attach/GPRS. Validate secure connection/certificate verification. If modem cannot support secure transport, record limitation, retain Wi-Fi demo. Do not weaken TLS.
8. Battery/power: supervised pack and connector validation, charger load disconnected, fuse and switch, output measurement and cutoff. Test branch currents, brownout and thermal conditions. Do not claim unattended vehicle-safe assembly.
9. Firmware event queue: persistent flash, stable event IDs, boot seq, CRC/recovery, bounded retries, batch ACK, overflow notice. Power-cycle during queued event test. Configure reporting and sleep modes.
10. Combine and mount in safe non-vehicle test enclosure. Controlled movement outside with authorised participant; compare actual known movement and observed GPS; no unsafe driving demo.

### 10.2 Firmware acceptance and telemetry contract

Follow schema version 1 in Architecture. Use separate UARTs for GNSS/modem where verified; I2C for MPU; RTC GPIO for wake. Firmware has transport abstraction: Wi-Fi HTTPS now, validated GPRS later. API server controls expected heartbeat policy and records applied config. Clock sync required for signed requests; preserve unknown event observation times. Store event queue in flash; don't erase before ACK. Remote commands queued, applied on next connect, no instant sleeping-device control. OTA deferred until signed image verification/rollback and flash partition testing.

**Gate 5:** real hardware GPS/MPU/tamper event shown on website, offline retry tested, power measurements recorded, modem secure capability verified or fallback labelled, no unvalidated field installation.

## 11. Phase 6 — Power optimisation, ML and pilot readiness

### 11.1 Power optimisation

Measure full battery-side standby/active current including breakout LEDs and converters. Separate energy for GPS fix, network attach, data send, retries, active movement and sleep. Use formula in Hardware, report assumptions and measured range. Test timer, motion and tamper wake, disable gyro in standby if supported, power off GNSS/modem safely and prevent backfeed. Compare demo high-rate config vs proposed stationary schedule. Battery endurance is a goal; don't claim months from nominal capacity alone. Custom PCB/low-power sensor/4G candidate only after bench findings and supplier quotations.

### 11.2 ML experiment plan

- Collect labelled sessions from controlled vehicles/fixture: stationary, bump, sustained vibration, meaningful movement, tilt/relocation, uncertain. Record device orientation, time, sensor range, sample rate, vehicle/session IDs and ground truth. Do not collect identifiable owner data without approval.
- Split train/validation/test by vehicle/session rather than random overlapping windows. Establish rule baseline and majority baseline. Features: mean, variance, RMS dynamic acceleration, peaks, duration, tilt/gyro and frequency bands. Handle gravity and sampling variability explicitly.
- Evaluate decision tree and compact Random Forest before more complex models. Confusion matrix, per-class precision/recall/F1, false alerts per stationary vehicle-day, test sample count, uncertainty and inference latency/memory. Don't treat a small controlled dataset as real-world reliability.
- Only export a measured model that improves baseline and fits actual firmware. Version feature pipeline, model and thresholds; unknown/low confidence fallback. Keep backend regulatory rules independent of ML predictions. Repeated journeys/anomaly detection optional; explain reasons, no probability of guilt.

### 11.3 Pilot gate

Obtain permission from problem provider/RTO, confirm official Non-Use conditions, monitoring policy, data access, privacy, hosting, retention, installation process, who responds, cost ceiling, and applicable vehicle tracking/radio/battery certifications. Confirm existing tracker reuse opportunities. Document environmental testing and support/maintenance. No actual government pilot until approved; SFIC prototype may operate on authorised test fixtures/vehicles with synthetic records.

## 12. Testing strategy and coverage

| Category | Minimum tests |
|---|---|
| Unit | Status transitions, registration normalisation, time range, GPS quality, distance, geofence hysteresis, risk reason, signature test vector, queue retry |
| Contract | JSON schema examples accepted by simulator/API/firmware, error response, ACK semantics, units/timezone, backward compatibility |
| DB | FKs, uniqueness, overlap, transaction rollback, append-only evidence, event dedupe, RLS, index queries |
| API | Auth expiry/revocation, role/scope, ID enumeration, validation, rate limit, concurrency, reports and storage access |
| Integration | Enrol→assign→ingest→worker→realtime→alert→review; late/replayed/invalid events, network gap, expired declaration |
| Browser E2E | Government/owner login, dashboard scope, filters, forms, map stale marker, case and export, keyboard/mobile layout |
| Hardware | Voltage/current transients, pinout, GPS valid/no fix, wake, tamper, power cycle, offline queue, safe charge and cutoff |
| Performance | Ingest bursts, worker lag, DB pool, map clustering, pagination, scoped realtime connections |
| Security | Wrong key, forged payload, reused request, same event different hash, secret leakage, cross-office/owner, stale session, object URLs |
| Accessibility | Keyboard focus, labels, contrast, reduced motion, non-colour statuses, screen-reader alternatives |
| Recovery | Restore DB backup, worker crash/lease recovery, device queue after reboot, deployment rollback |

Suggested tools: pytest for backend, database SQL tests/pgTAP if available, Playwright for E2E, Vitest for frontend, Ruff/type checking for Python, ESLint/TypeScript, simulator/load test scripts, lab multimeter/oscilloscope. CI runs lint/type/tests and build; use isolated ephemeral test DB with synthetic data. Add secret scanning and dependency checks. Do not publish real device credentials in CI logs.

### 12.1 Evidence metrics template

| Metric | Measurement method | Report |
|---|---|---|
| Movement detection recall | Labelled independent positive trials | TP/(TP+FN), count and conditions |
| False alarm rate | Stationary vehicle-hours/days | False alerts / observed days, sample duration |
| Alert latency | Device observed → API commit → UI visible | Median/p95 and failed cases, GNSS acquisition separately |
| GPS quality | Compare verified open-sky test locations | Error distribution/HDOP, no-fix fraction |
| Recovery | Inject outage and reboot | Sent/accepted/duplicate/rejected/lost counts |
| Battery | Battery-side current measurement | Standby, active, burst, assumptions and estimated days |
| Availability | Expected vs received heartbeat | Gap count/duration and policy |
| Scale | Synthetic realistic burst/steady load | throughput, error rate, p95, queue lag |
| Security | Negative tests | Passed/failed with reproduction notes |
| Cost | Actual receipts and assumptions | Prototype BOM, recurring plan and exclusions |

Targets from Problem Statement are proposals; report actual results even when below target. Store test protocol, date, build commit, board IDs, environment and anonymised evidence. Avoid cherry-picked success clips.

## 13. Deployment, operations and runbook

Development local, demo isolated, staging representative, production approved only. Host web with HTTPS; API/worker containers use private DB connection and managed secret storage. Run DB migrations in controlled deployment step, backup before risky change, backward-compatible API evolution. Environment-specific allowed origins, keys and demo controls. Health endpoints expose no sensitive detail. Use logging correlation ID, structured errors, redacted PII, metrics for event auth failure, ingest p95, outbox lag, missed heartbeats, notification failure, DB pool/disk. Alert technical operator on operational failures.

Runbook: if website stale, check API health, realtime subscription and canonical API query; if device offline, inspect last expected heartbeat, battery and network, do not mark compliance; if modem reboots, stop and inspect supply on bench; if invalid GPS, test open-sky antenna/fix, never generate fabricated coordinates; if duplicate alerts, inspect event/alert dedupe and worker transaction; if compromised credential, revoke/rotate, quarantine affected evidence and audit; if DB failure, stop ACK until commit available, preserve queue, restore tested backup; if role breach, revoke affected membership and review audit/access logs.

No official API or real owner record without authorisation. Backup/restore, retention, regional hosting and legal review before pilot. Document known issues and rollback path per release.

## 14. Suggested sprint schedule (adjust to actual SFIC deadline)

| Sprint | Workstreams | Exit milestone |
|---|---|---|
| A | Contracts, repo, landing/login shell, board inspection | Gate 0/1; UI navigable |
| B | DB migrations, RBAC, registry/declaration, simulator | Gate 2; local enrolment + scoped rollup |
| C | Ingest/outbox, realtime map, GPS/IMU bring-up | Gate 3; authenticated simulator and basic real data |
| D | Compliance rules, cases, owner views, Wi-Fi/tamper | Gate 4; end-to-end case |
| E | Battery/modem tests, offline recovery, exports | Gate 5; measured hardware integration |
| F | Validation, performance, accessibility, demo rehearsal | Test report + pilot questions, not pilot approval |

Sequence is dependency-based, not a guarantee of completion time. Frontend, backend and hardware work in parallel using frozen contracts. Delay optional ML, OTA, financial analytics and elaborate landing animations if they threaten the core demonstration. If deadline tight, prioritise working enrolment, physical Wi-Fi telemetry, map, movement alert, owner view and report; explicitly label unimplemented features.

## 15. SFIC presentation / live demonstration

Prepare synthetic Rajkot vehicle/declaration, demo accounts for operator/manager/officer/owner/state/national, one real test hardware device, a simulator fallback, printed actual BOM and measured test report. Verify network, GPS fix in suitable location, battery safety and backup USB supply. No claim that demo users are actual government officers.

Demo sequence:

1. Explain official PS000225 and why tax-related Non Use differs from seized vehicle yards. Explain target users and dispersed storage.
2. Show landing and role login; local operator registers fictional vehicle, declaration and approved boundary, assigns device.
3. Manager activates monitoring; state/national rollups show the same record once. Demonstrate restricted access from another office.
4. Show real device heartbeat and valid GPS location when available, with timestamp/source. Explain hardware and independent monitoring goal.
5. Physically move test device in controlled conditions, show IMU event and genuine GNSS displacement if available. If indoor constraints prevent a real fix, use labelled simulated geofence scenario and separate live motion demonstration.
6. RTO alert and owner notification appear automatically; open timeline/journey and case, submit owner response and record reviewer outcome.
7. Trigger case/mount switch and show separate tamper event. Simulate/disconnect network, show stale state and recover queued events without duplicate case.
8. Export investigation report with provenance and uncertainty. Explain cost, reusable model, measured performance, limitations and approval requirements.
9. Close with pilot plan, existing tracker reuse/4G transition and authorised VAHAN adapter readiness. No fictional recovered revenue or claimed official partnership.

## 16. Master acceptance checklist

- [ ] Exact PS000225 scope preserved; public branding does not claim government deployment.
- [ ] Five specs consistent; source modes and protocol version documented.
- [ ] Shared government portal with scope-aware navigation, owner portal and restricted technical section.
- [ ] Local office enrolment, review, declaration period, device assignment, state/national rollups.
- [ ] Server and DB scope checks; cross-office/owner/technical privilege tests.
- [ ] Real or clearly marked simulated authenticated event, durable ACK and live update.
- [ ] Valid/stale/unavailable GPS and heartbeat status; no fake pin.
- [ ] Movement and tamper detection, journey history, case and owner explanation.
- [ ] Replay, duplicates, out-of-order, offline queue, expiry and reassignment handled.
- [ ] Export with evidence, time, source and uncertainty; no automatic legal penalty.
- [ ] Board variants/power validated; SIM800L secure connectivity tested or Wi-Fi fallback disclosed.
- [ ] Battery endurance estimated from actual measurements, not claimed guarantee.
- [ ] Demo/production separation, secret handling, audit, backup and security tests.
- [ ] Known blockers and future RTO questions included in jury materials.

## 17. Open blockers and immediate next actions

| Blocker | Owner/workstream | Next action |
|---|---|---|
| Exact ESP32-S3/MPU6050/SIM800L board variants unknown | Hardware | Photograph, inspect docs, finalise actual pinout and power rails |
| NEO-6M and safe supporting parts not confirmed purchased | Hardware | Verify stock, buy compatible GPS, switches and approved supply components |
| 2G coverage and secure transport untested | Firmware | Bench test GPRS and TLS; keep Wi-Fi fallback |
| Official VAHAN access unavailable | Product/backend | Demo/manual adapter now; request authorised access/sample records |
| Legal Non-Use conditions, tax rules and allowed movement unknown | Product/RTO | Stakeholder interview; no automatic penalty or official rule claims |
| Battery lifetime and detection accuracy unmeasured | Hardware/ML | Controlled tests and report uncertainty |
| Team task ownership and competition timeline not confirmed | Integration lead | Assign workstream owners and actual sprint dates |

**Start website development with Phase 1 and Phase 0 contracts now.** Backend and simulator can be built in parallel, while hardware team validates power and board interfaces. The architecture and database documents are implementation contracts; changes should be recorded in ADRs and applied consistently across all five specifications.
