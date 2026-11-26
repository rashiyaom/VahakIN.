# VahakIN Backend API (`services/api`)

Python FastAPI modular monolith + DB-backed outbox worker.

Refer to [architecture.md](../../docs/spec/architecture.md) (§6–10) and [implementation.md](../../docs/spec/implementation.md) (§3, §7–9).

## Modules (`app/`)

- `core/` — `config`, `security` (JWT & device HMAC), `errors`, `logging` (PII-redacted), `db`
- `api/v1/` — Versioned HTTP endpoints (`/api/v1/*`)
- `domains/` — `identity`, `jurisdictions`, `registry`, `declarations`, `devices`, `ingestion`, `monitoring`, `geospatial`, `compliance`, `cases`, `reports`, `notifications`, `audit`, `ops`
- `integrations/` — `VehicleRecordsProvider` adapters (`base`, `demo`, `manual`, `official`)
- `workers/` — Durable outbox consumers, compliance rule evaluator, heartbeat gap detector
- `tests/` — `unit`, `integration`, `security`, `contract`
