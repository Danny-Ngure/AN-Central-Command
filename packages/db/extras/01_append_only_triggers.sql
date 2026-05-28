-- Append-only enforcement (SRS NFR-050, BR-050.1).
--
-- Four tables are append-only:
--   audit_log         — every meaningful action recorded; UPDATE/DELETE would defeat audit
--   visits            — visit log is event-sourced; no retroactive edits (BR-050.1)
--   station_reports   — election-day reports are immutable submissions
--   consent_log       — DPA audit trail of every consent event must be untamperable
--
-- A trigger denies UPDATE and DELETE on these tables for every database role except
-- the sealed-key `admin_audit` role (created in infra/init/01-extensions.sql).
-- In production, admin_audit credentials live in cloud KMS, separated from application
-- credentials, and are used only by sanctioned data-protection / legal operations.
--
-- INSERT remains allowed for the application role (subject to RLS).

CREATE OR REPLACE FUNCTION deny_update_delete_unless_admin_audit() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user = 'admin_audit' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'Append-only table: % is not modifiable (% denied by role %)',
    TG_TABLE_NAME, TG_OP, current_user
    USING ERRCODE = 'insufficient_privilege';
END
$$;

-- audit_log ---------------------------------------------------------------
DROP TRIGGER IF EXISTS audit_log_append_only_upd ON audit_log;
CREATE TRIGGER audit_log_append_only_upd
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION deny_update_delete_unless_admin_audit();

DROP TRIGGER IF EXISTS audit_log_append_only_del ON audit_log;
CREATE TRIGGER audit_log_append_only_del
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION deny_update_delete_unless_admin_audit();

-- visits ------------------------------------------------------------------
DROP TRIGGER IF EXISTS visits_append_only_upd ON visits;
CREATE TRIGGER visits_append_only_upd
  BEFORE UPDATE ON visits
  FOR EACH ROW EXECUTE FUNCTION deny_update_delete_unless_admin_audit();

DROP TRIGGER IF EXISTS visits_append_only_del ON visits;
CREATE TRIGGER visits_append_only_del
  BEFORE DELETE ON visits
  FOR EACH ROW EXECUTE FUNCTION deny_update_delete_unless_admin_audit();

-- station_reports ---------------------------------------------------------
DROP TRIGGER IF EXISTS station_reports_append_only_upd ON station_reports;
CREATE TRIGGER station_reports_append_only_upd
  BEFORE UPDATE ON station_reports
  FOR EACH ROW EXECUTE FUNCTION deny_update_delete_unless_admin_audit();

DROP TRIGGER IF EXISTS station_reports_append_only_del ON station_reports;
CREATE TRIGGER station_reports_append_only_del
  BEFORE DELETE ON station_reports
  FOR EACH ROW EXECUTE FUNCTION deny_update_delete_unless_admin_audit();

-- consent_log -------------------------------------------------------------
DROP TRIGGER IF EXISTS consent_log_append_only_upd ON consent_log;
CREATE TRIGGER consent_log_append_only_upd
  BEFORE UPDATE ON consent_log
  FOR EACH ROW EXECUTE FUNCTION deny_update_delete_unless_admin_audit();

DROP TRIGGER IF EXISTS consent_log_append_only_del ON consent_log;
CREATE TRIGGER consent_log_append_only_del
  BEFORE DELETE ON consent_log
  FOR EACH ROW EXECUTE FUNCTION deny_update_delete_unless_admin_audit();
