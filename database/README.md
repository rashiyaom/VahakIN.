# VahakIN Database (`database/`)

PostgreSQL + PostGIS (Supabase-managed for prototype).

Refer to [database.md](../docs/spec/database.md) and [implementation.md](../docs/spec/implementation.md) (§7).

## Migration Ordering

1. Extensions (`postgis`, `btree_gist`) and `private` schema
2. Reference & identity tables (`states`, `districts`, `rto_offices`, `profiles`)
3. RBAC (`roles`, `permissions`, `role_permissions`, `memberships`)
4. Registry (`vehicles`, `vehicle_ownerships`, `vehicle_office_history`)
5. Declarations & geofences (`declarations`, `declaration_actions`, `geofence_versions`)
6. Devices & assignments (`devices`, `private.device_credentials`, `device_assignments`)
7. Telemetry & projections (`device_events`, `location_fixes`, `monitoring_state`, `outbox_jobs`, `private.device_request_replays`)
8. Journeys, alerts & cases (`journeys`, `alerts`, `incidents`, `incident_evidence`, `incident_actions`, `owner_responses`, `notifications`)
9. Audit (`audit_logs`), RLS policies, grants, indexes & `seed/demo/` synthetic fixtures

## Tax & Compliance Intelligence

See the [implementation, API, permissions, demo guide and production limitations](../docs/implementation/tax-compliance.md). The working DEMO extends the existing Next.js services. Migration `0010_tax_compliance.sql` is unapplied and requires the foundational database schema; official processing remains disabled.
