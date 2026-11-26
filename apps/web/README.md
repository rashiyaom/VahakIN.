# VahakIN Web Application (`apps/web`)

Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Lucide + MapLibre GL JS + Recharts.

Refer to [architecture.md](../../docs/spec/architecture.md) (§4–5) and [implementation.md](../../docs/spec/implementation.md) (§3, §6, §8.3, §9.2).

## Route Structure (`app/`)

- **`(public)/`**: `/`, `/about`, `/how-it-works`, `/impact`, `/help`, `/privacy`
- **Identity:** `/login/government`, `/login/owner`, `/auth/callback`, `/unauthorized`
- **Government Portal (`/gov`):** `/gov`, `/gov/states`, `/gov/offices`, `/gov/offices/[id]`, `/gov/vehicles`, `/gov/vehicles/new`, `/gov/vehicles/[id]`, `/gov/declarations`, `/gov/monitoring`, `/gov/geofences`, `/gov/alerts`, `/gov/investigations`, `/gov/investigations/[id]`, `/gov/compliance`, `/gov/devices`, `/gov/devices/[id]`, `/gov/employees`, `/gov/reports`, `/gov/audit`, `/gov/settings`
- **Owner Portal (`/owner`, mobile-first PWA):** `/owner`, `/owner/vehicles`, `/owner/vehicles/[id]`, `/owner/vehicles/[id]/tracking`, `/owner/alerts`, `/owner/declarations`, `/owner/requests`, `/owner/incidents/[id]`, `/owner/documents`, `/owner/settings`, `/owner/support`
- **Technical Workspace (`/ops`):** `/ops/devices`, `/ops/provisioning`, `/ops/firmware`, `/ops/health`, `/ops/integrations`, `/ops/audit`, `/ops/simulator`

## Code Organisation

- `components/` — Shared UI primitives (`ui`, `layout`, `maps`, `charts`, `vehicles`, `alerts`, `devices`)
- `features/` — Domain-aligned frontend modules (`identity`, `registry`, `declarations`, `monitoring`, `cases`, `devices`, `reports`, `ops`)
- `lib/` — Client infrastructure (`api`, `auth`, `permissions`, `realtime`, `format`, `validation`, `i18n`)
- `styles/` — Theme tokens, institutional light/dark surfaces, reduced-motion styles
- `tests/` — Vitest (`unit/`) and Playwright (`e2e/`) suites

## Local dashboard prototype (November 2026)

Open `/demo` to explore ten fictional accounts. The dashboard layout adapts
[24CS094Purva/pixel-perfect-twin-maker](https://github.com/24CS094Purva/pixel-perfect-twin-maker)
at revision `b04d56ab29f6d1e6b7f12523131b4362d6906cc2`: horizontal charcoal/lime
navigation, blue summary surfaces, and a dark master list beside a blue detail
workspace. VahakIN branding, responsive layouts, and operational data replace
the original invoice content.

The server checks permission, jurisdiction, assigned records and verified demo
ownership independently of navigation. Sessions use opaque, hashed tokens and
HttpOnly cookies; sign-out revokes the session. All records are fictional.
Demo storage is `.data/vahakin-demo.json`, ignored by Git. It is a **single-process
local prototype store**, not a production database or an implementation of RLS.
Production mode disables demos unless `VAHAKIN_DEMO_MODE=true` is explicitly set.
Do not enable this mode on a deployment containing real records.

Working workflows: role-scoped summaries, state/office filters, vehicle search and
inspection, draft enrolment with duplicate prevention, independent draft review,
alert acknowledgement and assignment, append-only findings, movement requests,
maintenance records, audited CSV exports and technical-only telemetry simulation.
Simulator events preserve separate observation/reception/GPS timestamps, deduplicate
identities, avoid regressing newer positions and require two quality-accepted
fixes for the illustrative geofence rule. The UI polls every 30 seconds.

Not yet connected: Supabase/FastAPI production identity and persistence, OTP/MFA,
real device-authenticated ingestion, official government APIs, verified tax rules,
private document storage, historical journey replay, approved geofence editing,
remote device commands and external notification delivery. No automatic penalties
or official approvals are produced. MapLibre uses CARTO basemap tiles; when the
network or WebGL is unavailable, the authorized coordinate list remains usable.
Tilt view is not claimed as 3D building extrusion or satellite imagery.

Run `npm run typecheck`, `npm test -- tests/unit`, and `npm run test:e2e` (with the
local app already running on port 3000). E2E tests create additional fictional
drafts, requests and telemetry. `VAHAKIN_TEST_URL` can select another local URL.
Use `VAHAKIN_BUILD_DIR=.next-verify npm run build` to verify production compilation
without replacing a running dev server's `.next` output.

## Tax & Compliance Intelligence

See the [implementation, API, permissions, demo guide and production limitations](../../docs/implementation/tax-compliance.md). The working DEMO extends the existing Next.js services. Migration `0010_tax_compliance.sql` is unapplied and requires the foundational database schema; official processing remains disabled.

## Owner onboarding and RTO review

New fictional owners can now follow a six-step device-to-application flow at `/owner/onboarding`, with saved drafts, private PDF/image uploads, conditional documents, Rajkot city routing and versioned submissions. `/gov/applications` provides scoped review, correction requests, reasoned rejection and independent approval. Approved applications create linked registry records; installation and monitoring remain separate. `/demo` includes recent applicant identities for resuming after switching roles.

See [the walkthrough, government sources, endpoint contracts and deployment limits](../../docs/implementation/owner-onboarding.md). This is functional local DEMO storage, not production authentication, official government submission or real device ingestion.
