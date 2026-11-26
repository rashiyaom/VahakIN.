# VahakIN

**Declared Non Use. Verified Compliance.**

VahakIN is a proposed GPS-based monitoring and regulatory decision-support platform for vehicles officially declared **Non Use** (SFIC 2026 Problem ID `PS000225`, Collector Office – Rajkot; CSPIT, CHARUSAT University, `TM002281`).

> [!IMPORTANT]
> This repository is an SFIC prototype under active development, not an approved government deployment or an official VAHAN integration. All demo records must be explicitly labelled `DEMO` and isolated from production credentials or real owner PII.

## Specifications

Authoritative specifications live in [`docs/spec/`](docs/spec/):

- [Problem statement (`IG-PS-01`)](docs/spec/problem%20statement.md)
- [System and website architecture (`IG-ARC-02`)](docs/spec/architecture.md)
- [Hardware, firmware and procurement (`IG-HW-03`)](docs/spec/harware.md)
- [Database, data contracts and security (`IG-DB-04`)](docs/spec/database.md)
- [End-to-end implementation plan (`IG-IMP-05`)](docs/spec/implementation.md)
- [Development environment requirements](docs/spec/requirements.md)

## Monorepo Layout

```text
.
├── apps/web/              # Next.js App Router website (public, /gov, /owner, /ops)
├── services/api/          # Python FastAPI modular monolith & outbox worker
├── packages/
│   ├── contracts/         # Shared telemetry v1 JSON schema, examples & test vectors
│   └── api-client/        # Generated typed client for apps/web
├── database/              # PostgreSQL + PostGIS migrations, RLS policies & demo seeds
├── tools/                 # Deterministic device simulator, provisioning & load tools
├── firmware/              # ESP32-S3 firmware modules & hardware bring-up tests
├── ml/                    # Labelled motion experiments (no private/raw data in Git)
├── infra/                 # Docker, deployment & monitoring configurations
└── docs/                  # Specs, ADRs, API notes, test evidence & demo guides
```

## Implementation Phases

Follow [implementation.md](docs/spec/implementation.md):
1. **Phase 0:** Contracts, telemetry v1 schema, HMAC test vectors, and design tokens.
2. **Phase 1:** Next.js App Router shell, public pages, government/owner login, RBAC/scope enforcement.
3. **Phase 2:** PostgreSQL + PostGIS schema, RLS, registry, and Non-Use declaration enrolment wizard.
4. **Phase 3:** Device simulator, signed ingestion API, outbox worker, and live scoped map/alerts.
5. **Phase 4–6:** Compliance rules, investigations, owner portal, ESP32-S3 hardware bring-up, and validation.

## Tax & Compliance Intelligence

See the [implementation, API, permissions, demo guide and production limitations](docs/implementation/tax-compliance.md). The working DEMO extends the existing Next.js services. Migration `0010_tax_compliance.sql` is unapplied and requires the foundational database schema; official processing remains disabled.

## Owner onboarding

The local DEMO now includes device claiming, a guided six-step application, private document uploads and a shared Rajkot RTO review queue. Approval creates the owner–vehicle–device registry relationship while keeping installation and monitoring verification separate. Start from **Start new owner setup · demo** on the owner login page. See [the implementation and research notes](docs/implementation/owner-onboarding.md).
