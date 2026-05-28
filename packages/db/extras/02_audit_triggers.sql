-- Auto-audit triggers (SRS NFR-050, AUD-*).
--
-- Every writable table gets a trigger that automatically inserts a row into audit_log
-- for INSERT, UPDATE, and DELETE operations. The audit guarantee does not depend on
-- application code remembering to call an audit function — that is belt-and-braces.
--
-- The trigger reads three per-transaction session variables set by the API layer
-- via setRequestContext():
--   app.role        — the active CampaignRole (15 values from SRS §2.2)
--   app.person_id   — the authenticated user's UUID
--   app.ward_id     — the user's ward scope (optional, for ward-scoped roles)
--
-- If a query runs without setRequestContext() (e.g. a system job or a migration),
-- the trigger falls back to actor_role='system' and actor_person_id=NULL.
--
-- audit_log itself is NOT audited (would recurse infinitely).
-- visits / station_reports / consent_log are append-only: only AFTER INSERT fires;
-- UPDATE/DELETE are blocked by the append-only triggers in 01_*.

CREATE OR REPLACE FUNCTION audit_table_change() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor_role text;
  v_actor_person uuid;
  v_entity_id uuid;
  v_before jsonb;
  v_after jsonb;
BEGIN
  -- Pull session vars; tolerant of missing settings (system / migration paths).
  BEGIN
    v_actor_role := current_setting('app.role', true);
  EXCEPTION WHEN OTHERS THEN
    v_actor_role := NULL;
  END;

  BEGIN
    v_actor_person := NULLIF(current_setting('app.person_id', true), '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_actor_person := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    v_entity_id := (OLD).id;
    v_before := to_jsonb(OLD);
    v_after := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    v_entity_id := (NEW).id;
    v_before := to_jsonb(OLD);
    v_after := to_jsonb(NEW);
  ELSE  -- INSERT
    v_entity_id := (NEW).id;
    v_before := NULL;
    v_after := to_jsonb(NEW);
  END IF;

  INSERT INTO audit_log (
    actor_person_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before_value,
    after_value,
    context
  ) VALUES (
    v_actor_person,
    COALESCE(v_actor_role, 'system'),
    TG_OP || '_' || upper(TG_TABLE_NAME),
    TG_TABLE_NAME,
    v_entity_id,
    v_before,
    v_after,
    jsonb_build_object('trigger', 'auto', 'tg_when', TG_WHEN)
  );

  RETURN COALESCE(NEW, OLD);
END
$$;

-- Identity ----------------------------------------------------------------
DROP TRIGGER IF EXISTS people_audit ON people;
CREATE TRIGGER people_audit
  AFTER INSERT OR UPDATE OR DELETE ON people
  FOR EACH ROW EXECUTE FUNCTION audit_table_change();

DROP TRIGGER IF EXISTS auth_credentials_audit ON auth_credentials;
CREATE TRIGGER auth_credentials_audit
  AFTER INSERT OR UPDATE OR DELETE ON auth_credentials
  FOR EACH ROW EXECUTE FUNCTION audit_table_change();

DROP TRIGGER IF EXISTS sessions_audit ON sessions;
CREATE TRIGGER sessions_audit
  AFTER INSERT OR UPDATE OR DELETE ON sessions
  FOR EACH ROW EXECUTE FUNCTION audit_table_change();

-- Geography ---------------------------------------------------------------
DROP TRIGGER IF EXISTS constituencies_audit ON constituencies;
CREATE TRIGGER constituencies_audit
  AFTER INSERT OR UPDATE OR DELETE ON constituencies
  FOR EACH ROW EXECUTE FUNCTION audit_table_change();

DROP TRIGGER IF EXISTS wards_audit ON wards;
CREATE TRIGGER wards_audit
  AFTER INSERT OR UPDATE OR DELETE ON wards
  FOR EACH ROW EXECUTE FUNCTION audit_table_change();

DROP TRIGGER IF EXISTS sub_locations_audit ON sub_locations;
CREATE TRIGGER sub_locations_audit
  AFTER INSERT OR UPDATE OR DELETE ON sub_locations
  FOR EACH ROW EXECUTE FUNCTION audit_table_change();

DROP TRIGGER IF EXISTS villages_audit ON villages;
CREATE TRIGGER villages_audit
  AFTER INSERT OR UPDATE OR DELETE ON villages
  FOR EACH ROW EXECUTE FUNCTION audit_table_change();

DROP TRIGGER IF EXISTS polling_stations_audit ON polling_stations;
CREATE TRIGGER polling_stations_audit
  AFTER INSERT OR UPDATE OR DELETE ON polling_stations
  FOR EACH ROW EXECUTE FUNCTION audit_table_change();

-- Community ---------------------------------------------------------------
DROP TRIGGER IF EXISTS community_sites_audit ON community_sites;
CREATE TRIGGER community_sites_audit
  AFTER INSERT OR UPDATE OR DELETE ON community_sites
  FOR EACH ROW EXECUTE FUNCTION audit_table_change();

DROP TRIGGER IF EXISTS community_leaders_audit ON community_leaders;
CREATE TRIGGER community_leaders_audit
  AFTER INSERT OR UPDATE OR DELETE ON community_leaders
  FOR EACH ROW EXECUTE FUNCTION audit_table_change();

DROP TRIGGER IF EXISTS village_issues_audit ON village_issues;
CREATE TRIGGER village_issues_audit
  AFTER INSERT OR UPDATE OR DELETE ON village_issues
  FOR EACH ROW EXECUTE FUNCTION audit_table_change();

-- Activities --------------------------------------------------------------
DROP TRIGGER IF EXISTS activities_audit ON activities;
CREATE TRIGGER activities_audit
  AFTER INSERT OR UPDATE OR DELETE ON activities
  FOR EACH ROW EXECUTE FUNCTION audit_table_change();

-- visits is append-only; UPDATE/DELETE blocked by 01_*. Audit only INSERT.
DROP TRIGGER IF EXISTS visits_audit ON visits;
CREATE TRIGGER visits_audit
  AFTER INSERT ON visits
  FOR EACH ROW EXECUTE FUNCTION audit_table_change();

DROP TRIGGER IF EXISTS meetings_audit ON meetings;
CREATE TRIGGER meetings_audit
  AFTER INSERT OR UPDATE OR DELETE ON meetings
  FOR EACH ROW EXECUTE FUNCTION audit_table_change();

-- Supporters (restricted) -------------------------------------------------
DROP TRIGGER IF EXISTS community_programs_audit ON community_programs;
CREATE TRIGGER community_programs_audit
  AFTER INSERT OR UPDATE OR DELETE ON community_programs
  FOR EACH ROW EXECUTE FUNCTION audit_table_change();

DROP TRIGGER IF EXISTS committed_supporters_audit ON committed_supporters;
CREATE TRIGGER committed_supporters_audit
  AFTER INSERT OR UPDATE OR DELETE ON committed_supporters
  FOR EACH ROW EXECUTE FUNCTION audit_table_change();

-- consent_log is append-only; UPDATE/DELETE blocked by 01_*. Audit only INSERT.
DROP TRIGGER IF EXISTS consent_log_audit ON consent_log;
CREATE TRIGGER consent_log_audit
  AFTER INSERT ON consent_log
  FOR EACH ROW EXECUTE FUNCTION audit_table_change();

-- Election day ------------------------------------------------------------
-- station_reports append-only; audit only INSERT.
DROP TRIGGER IF EXISTS station_reports_audit ON station_reports;
CREATE TRIGGER station_reports_audit
  AFTER INSERT ON station_reports
  FOR EACH ROW EXECUTE FUNCTION audit_table_change();

DROP TRIGGER IF EXISTS incidents_audit ON incidents;
CREATE TRIGGER incidents_audit
  AFTER INSERT OR UPDATE OR DELETE ON incidents
  FOR EACH ROW EXECUTE FUNCTION audit_table_change();
