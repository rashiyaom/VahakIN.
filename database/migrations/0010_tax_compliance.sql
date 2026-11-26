-- Additive migration for the PostgreSQL/Supabase architecture in docs/spec/database.md.
-- The foundation migration is not implemented in this repository. This migration
-- deliberately aborts rather than creating duplicate vehicle/identity/case tables.
BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
DO $$
DECLARE required_table text;
BEGIN
 FOREACH required_table IN ARRAY ARRAY['profiles','vehicles','declarations','incidents','device_events','rto_offices','states'] LOOP
  IF to_regclass('public.' || required_table) IS NULL THEN
   RAISE EXCEPTION 'Tax migration prerequisite missing: public.%. Apply the shared registry/identity/case foundation first.', required_table;
  END IF;
 END LOOP;
END $$;

ALTER TABLE public.declarations ADD COLUMN IF NOT EXISTS legal_stage text NOT NULL DEFAULT 'unverified'
 CHECK (legal_stage IN ('submitted','admitted','certified','unverified'));
ALTER TABLE public.declarations ADD COLUMN IF NOT EXISTS certified_period daterange;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS taxation_profile jsonb NOT NULL DEFAULT '{}';
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS case_type text NOT NULL DEFAULT 'operational';
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS tax_review_status text;
ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS disclosed_to_owner boolean NOT NULL DEFAULT false;

CREATE TABLE public.tax_rule_sets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rule_family uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 state_id uuid NOT NULL REFERENCES public.states(id), office_id uuid REFERENCES public.rto_offices(id),
 vehicle_classification text NOT NULL, integration_mode text NOT NULL CHECK(integration_mode IN ('DEMO','MANUAL','OFFICIAL')),
 status text NOT NULL CHECK(status IN ('draft','pending_verification','verified','active','superseded')),
 provision text NOT NULL, schedule_reference text NOT NULL, notification_reference text,
 official_source_url text, effective_period daterange NOT NULL CHECK(NOT isempty(effective_period)),
 rate_paise bigint CHECK(rate_paise>=0), rate_unit text, calculation_method text NOT NULL,
 applicability jsonb NOT NULL DEFAULT '{}', rounding_policy text NOT NULL,
 prepared_by uuid NOT NULL REFERENCES public.profiles(id), verified_by uuid REFERENCES public.profiles(id),
 approved_by uuid REFERENCES public.profiles(id), approved_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(rule_family,version), CHECK(verified_by IS NULL OR verified_by<>prepared_by),
 CHECK(status<>'active' OR integration_mode='DEMO' OR (notification_reference IS NOT NULL AND official_source_url IS NOT NULL AND verified_by IS NOT NULL AND approved_by IS NOT NULL AND rate_paise IS NOT NULL))
);
CREATE TABLE public.statutory_authorizations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id),
 state_id uuid NOT NULL REFERENCES public.states(id), office_id uuid REFERENCES public.rto_offices(id),
 action_code text NOT NULL, integration_mode text NOT NULL CHECK(integration_mode IN ('DEMO','MANUAL','OFFICIAL')),
 appointment_reference text NOT NULL, verified_by uuid NOT NULL REFERENCES public.profiles(id),
 validity tstzrange NOT NULL CHECK(NOT isempty(validity)), revoked_at timestamptz,
 CHECK(user_id<>verified_by)
);
CREATE TABLE public.movement_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vehicle_id uuid NOT NULL REFERENCES public.vehicles(id),
 declaration_id uuid NOT NULL REFERENCES public.declarations(id), office_id uuid NOT NULL REFERENCES public.rto_offices(id),
 integration_mode text NOT NULL CHECK(integration_mode IN ('DEMO','MANUAL','OFFICIAL')),
 start_at timestamptz NOT NULL, end_at timestamptz NOT NULL CHECK(end_at>=start_at),
 observed_facts jsonb NOT NULL, inference text NOT NULL, classification text NOT NULL,
 algorithm_version text NOT NULL, original_sha256 bytea NOT NULL CHECK(octet_length(original_sha256)=32),
 authentication_status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.movement_evidence_events (
 evidence_id uuid NOT NULL REFERENCES public.movement_evidence(id),
 event_id uuid NOT NULL REFERENCES public.device_events(id), PRIMARY KEY(evidence_id,event_id)
);
CREATE TABLE public.tax_case_evidence (
 case_id uuid NOT NULL REFERENCES public.incidents(id), evidence_id uuid NOT NULL REFERENCES public.movement_evidence(id),
 disclosed_to_owner boolean NOT NULL DEFAULT false, associated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(case_id,evidence_id)
);
CREATE TABLE public.tax_evidence_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid NOT NULL, evidence_id uuid NOT NULL,
 disposition text NOT NULL CHECK(disposition IN ('relied_upon','inconclusive','excluded')),
 reason text NOT NULL CHECK(length(reason)>=10), reviewer_id uuid NOT NULL REFERENCES public.profiles(id), at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(case_id,evidence_id) REFERENCES public.tax_case_evidence(case_id,evidence_id)
);
CREATE TABLE public.tax_assessments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid NOT NULL REFERENCES public.incidents(id),
 vehicle_id uuid NOT NULL REFERENCES public.vehicles(id), declaration_id uuid NOT NULL REFERENCES public.declarations(id),
 office_id uuid NOT NULL REFERENCES public.rto_offices(id), integration_mode text NOT NULL CHECK(integration_mode IN ('DEMO','MANUAL','OFFICIAL')),
 revision integer NOT NULL CHECK(revision>0), replaces_id uuid REFERENCES public.tax_assessments(id),
 assessable_period daterange NOT NULL CHECK(NOT isempty(assessable_period)),
 rule_id uuid NOT NULL REFERENCES public.tax_rule_sets(id), rule_snapshot jsonb NOT NULL,
 calculation_version text NOT NULL, calculation_snapshot jsonb NOT NULL,
 base_paise bigint NOT NULL CHECK(base_paise>=0), penalty_paise bigint NOT NULL CHECK(penalty_paise>=0),
 credits_paise bigint NOT NULL DEFAULT 0 CHECK(credits_paise>=0), total_paise bigint NOT NULL CHECK(total_paise>=0),
 penalty_18_1 boolean NOT NULL DEFAULT false, penalty_18_1a boolean NOT NULL DEFAULT false,
 status text NOT NULL CHECK(status IN ('proposed','under_review','approved','returned','superseded','cancelled')),
 prepared_by uuid NOT NULL REFERENCES public.profiles(id), reviewed_by uuid REFERENCES public.profiles(id),
 approved_by uuid REFERENCES public.profiles(id), authority_id uuid REFERENCES public.statutory_authorizations(id),
 reason text NOT NULL, disclosed_to_owner boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), approved_at timestamptz,
 UNIQUE(case_id,revision), CHECK(NOT(penalty_18_1 AND penalty_18_1a)),
 CHECK(total_paise=base_paise+penalty_paise-credits_paise), CHECK(NOT penalty_18_1a OR penalty_paise=base_paise*2),
 CHECK(reviewed_by IS NULL OR reviewed_by<>prepared_by),
 CHECK(status<>'approved' OR (approved_by IS NOT NULL AND reviewed_by IS NOT NULL AND authority_id IS NOT NULL AND approved_by<>prepared_by)),
 EXCLUDE USING gist(vehicle_id WITH =,integration_mode WITH =,assessable_period WITH &&) WHERE(status='approved')
);
CREATE TABLE public.tax_assessment_evidence (
 assessment_id uuid NOT NULL REFERENCES public.tax_assessments(id), evidence_id uuid NOT NULL REFERENCES public.movement_evidence(id),
 integrity_hash bytea NOT NULL, rationale text NOT NULL, PRIMARY KEY(assessment_id,evidence_id)
);
CREATE TABLE public.tax_owner_responses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid NOT NULL REFERENCES public.incidents(id),
 owner_id uuid NOT NULL REFERENCES public.profiles(id), response_kind text NOT NULL, explanation text NOT NULL,
 permission_reference text, acknowledgement_reference text NOT NULL UNIQUE, submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tax_response_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), response_id uuid NOT NULL REFERENCES public.tax_owner_responses(id),
 reviewer_id uuid NOT NULL REFERENCES public.profiles(id), finding text NOT NULL, at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tax_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), case_id uuid NOT NULL REFERENCES public.incidents(id),
 uploader_id uuid NOT NULL REFERENCES public.profiles(id), private_object_key text NOT NULL UNIQUE,
 sha256 bytea NOT NULL CHECK(octet_length(sha256)=32), bytes bigint NOT NULL CHECK(bytes>0),
 mime_type text NOT NULL, filename text NOT NULL, malware_scan_status text NOT NULL DEFAULT 'pending',
 disclosed_to_owner boolean NOT NULL DEFAULT false, legal_hold boolean NOT NULL DEFAULT false,
 retention_policy_reference text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tax_response_documents (
 response_id uuid NOT NULL REFERENCES public.tax_owner_responses(id), document_id uuid NOT NULL REFERENCES public.tax_documents(id), PRIMARY KEY(response_id,document_id)
);
CREATE TABLE public.tax_regulatory_notices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), assessment_id uuid NOT NULL REFERENCES public.tax_assessments(id),
 integration_mode text NOT NULL CHECK(integration_mode IN ('DEMO','MANUAL','OFFICIAL')),
 status text NOT NULL CHECK(status IN ('draft','issued','cancelled')),
 official_reference text, verified_format_reference text, prepared_by uuid NOT NULL REFERENCES public.profiles(id),
 issued_by uuid REFERENCES public.profiles(id), authority_id uuid REFERENCES public.statutory_authorizations(id),
 issued_at timestamptz, service_reference text, response_deadline timestamptz,
 CHECK(status<>'issued' OR (issued_by IS NOT NULL AND authority_id IS NOT NULL AND issued_by<>prepared_by AND official_reference IS NOT NULL AND (integration_mode='DEMO' OR verified_format_reference IS NOT NULL)))
);
CREATE UNIQUE INDEX one_active_tax_notice ON public.tax_regulatory_notices(assessment_id) WHERE(status<>'cancelled');
CREATE TABLE public.tax_payment_reconciliations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), notice_id uuid NOT NULL REFERENCES public.tax_regulatory_notices(id),
 integration_mode text NOT NULL CHECK(integration_mode IN ('DEMO','MANUAL','OFFICIAL')),
 provider_reference text NOT NULL, source_reference text NOT NULL, amount_paise bigint NOT NULL CHECK(amount_paise>0),
 reconciled_by uuid NOT NULL REFERENCES public.profiles(id), authority_id uuid NOT NULL REFERENCES public.statutory_authorizations(id),
 at timestamptz NOT NULL DEFAULT now(), UNIQUE(integration_mode,provider_reference)
);
CREATE TABLE public.tax_appeal_references (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), assessment_id uuid NOT NULL REFERENCES public.tax_assessments(id),
 appeal_reference text NOT NULL, status text NOT NULL, stay_in_effect boolean NOT NULL DEFAULT false,
 stay_reference text, verified_by uuid NOT NULL REFERENCES public.profiles(id), at timestamptz NOT NULL DEFAULT now(),
 CHECK(NOT stay_in_effect OR stay_reference IS NOT NULL)
);
CREATE TABLE public.tax_financial_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES public.profiles(id), office_id uuid REFERENCES public.rto_offices(id),
 action text NOT NULL, entity_reference text NOT NULL, reason text NOT NULL, integration_mode text NOT NULL,
 previous_hash bytea, record_hash bytea NOT NULL, at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tax_idempotency (
 actor_id uuid NOT NULL REFERENCES public.profiles(id), request_id uuid NOT NULL, request_hash bytea NOT NULL,
 response_snapshot jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_id,request_id)
);
CREATE FUNCTION public.tax_immutable_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Original evidence, responses, reconciliations and audit records are append-only'; END $$;
DO $$
DECLARE name text;
BEGIN
 FOREACH name IN ARRAY ARRAY['movement_evidence','movement_evidence_events','tax_evidence_reviews','tax_owner_responses','tax_response_reviews','tax_payment_reconciliations','tax_financial_audit'] LOOP
  EXECUTE format('CREATE TRIGGER immutable_tax_record BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.tax_immutable_record()',name);
 END LOOP;
END $$;
CREATE FUNCTION public.tax_preserve_approved_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status IN ('approved','superseded','cancelled') AND
  (NEW.calculation_snapshot IS DISTINCT FROM OLD.calculation_snapshot OR NEW.rule_snapshot IS DISTINCT FROM OLD.rule_snapshot OR
   NEW.base_paise<>OLD.base_paise OR NEW.penalty_paise<>OLD.penalty_paise OR NEW.total_paise<>OLD.total_paise OR NEW.assessable_period<>OLD.assessable_period) THEN
  RAISE EXCEPTION 'Create a traceable revision; approved calculation snapshots cannot be overwritten';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER preserve_tax_snapshot BEFORE UPDATE ON public.tax_assessments FOR EACH ROW EXECUTE FUNCTION public.tax_preserve_approved_snapshot();
CREATE FUNCTION public.tax_reconcile_balance() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n public.tax_regulatory_notices; a public.tax_assessments; paid bigint;
BEGIN
 SELECT * INTO n FROM public.tax_regulatory_notices WHERE id=NEW.notice_id FOR UPDATE;
 SELECT * INTO a FROM public.tax_assessments WHERE id=n.assessment_id;
 IF n.status<>'issued' OR a.status<>'approved' OR NEW.integration_mode<>n.integration_mode OR n.integration_mode<>a.integration_mode THEN
  RAISE EXCEPTION 'Reconciliation requires an active demand in the same integration mode';
 END IF;
 SELECT coalesce(sum(amount_paise),0) INTO paid FROM public.tax_payment_reconciliations WHERE notice_id=n.id;
 IF paid+NEW.amount_paise>a.total_paise THEN RAISE EXCEPTION 'Payment exceeds outstanding demand'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_tax_payment BEFORE INSERT ON public.tax_payment_reconciliations FOR EACH ROW EXECUTE FUNCTION public.tax_reconcile_balance();

-- No client receives direct table access. RLS is fail-closed until the shared
-- membership/ownership service and audited field-level views are deployed.
-- Never add a blanket authenticated or service-role SELECT policy for owners.
DO $$
DECLARE name text;
BEGIN
 FOREACH name IN ARRAY ARRAY['tax_rule_sets','statutory_authorizations','movement_evidence','movement_evidence_events','tax_case_evidence','tax_evidence_reviews','tax_assessments','tax_assessment_evidence','tax_owner_responses','tax_response_reviews','tax_documents','tax_response_documents','tax_regulatory_notices','tax_payment_reconciliations','tax_appeal_references','tax_financial_audit','tax_idempotency'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',name);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC',name);
 END LOOP;
END $$;
COMMIT;
