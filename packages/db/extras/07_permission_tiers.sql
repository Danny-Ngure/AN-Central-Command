-- ============================================================================
-- 07 — Permission tiers (campaign direction, 2026)
-- ============================================================================
-- Refines the access model into the tiers the campaign asked for:
--
--   • SUPER ADMIN  — Dan Ngure (role tech_lead). Full write everywhere. Sole holder
--                    of: full audit log, admin password reset, power/role grants.
--                    (Audit + password-reset gating live in the app layer; this file
--                    handles the DB write/read tiers.)
--   • EXECUTIVE    — Alfayo Nelson (candidate) + Benson Imoli & Irene Mkamburi
--                    (chief_strategist). Read + WRITE everywhere. No audit, no power
--                    grants (enforced app-side).
--   • DEPT HEADS / WARD REPS / ASSISTANTS — read the WHOLE app, but write only their
--                    own ward (ward roles) or their own content (dept heads, via the
--                    owner-based policies already in place). They can NOT edit another
--                    ward's or department's data.
--   • FIELD (canvasser, influence_liaison, polling) — unchanged, scoped access.
--
-- Mechanism:
--   1. rls_is_leadership() is narrowed to the EXECUTIVE write tier. Because every
--      "write anywhere" policy in 03_rls_policies.sql is expressed through this
--      function, narrowing it here restricts blanket write to executives in one
--      place — campaign_manager & constituency_coordinator keep only their
--      owner/ward-scoped writes.
--   2. rls_can_read_all() is the new READ tier (dept heads + ward reps + assistants).
--      Additive SELECT policies below open the operational tables to them so they can
--      see the whole app. Voter / supporter / consent PII is deliberately NOT opened.
--
-- Reversible: restore the original rls_is_leadership() body (5 roles) and DROP the
-- *_read_all_app policies to return to the previous model.
-- ============================================================================

-- (1) Executive write tier — was: candidate, campaign_manager, chief_strategist,
--     constituency_coordinator, tech_lead. Now the three that may write everywhere.
CREATE OR REPLACE FUNCTION rls_is_leadership() RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT rls_role() IN ('candidate', 'chief_strategist', 'tech_lead')
$$;

-- Kept as a clearly-named alias for future policies/readers.
CREATE OR REPLACE FUNCTION rls_is_executive() RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT rls_role() IN ('candidate', 'chief_strategist', 'tech_lead')
$$;

-- (2) "Read the whole app" tier: executives + dept heads + ward reps & assistants.
--     Field roles (canvasser, influence_liaison, polling_*) stay scoped.
CREATE OR REPLACE FUNCTION rls_can_read_all() RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT rls_role() IN (
    'candidate', 'chief_strategist', 'tech_lead',
    'campaign_manager', 'constituency_coordinator', 'patron_ceo',
    'media_head', 'comms_head', 'finance_lead',
    'ward_coordinator', 'assistant_ward_coordinator'
  )
$$;

-- Additive whole-app READ on operational tables (permissive — OR-combined with the
-- existing per-scope read policies). PII tables (voters, committed_supporters,
-- consent_log) are intentionally omitted.
DROP POLICY IF EXISTS people_read_all_app ON people;
CREATE POLICY people_read_all_app ON people FOR SELECT USING (rls_can_read_all());

DROP POLICY IF EXISTS sites_read_all_app ON community_sites;
CREATE POLICY sites_read_all_app ON community_sites FOR SELECT USING (rls_can_read_all());

DROP POLICY IF EXISTS leaders_read_all_app ON community_leaders;
CREATE POLICY leaders_read_all_app ON community_leaders FOR SELECT USING (rls_can_read_all());

DROP POLICY IF EXISTS issues_read_all_app ON village_issues;
CREATE POLICY issues_read_all_app ON village_issues FOR SELECT USING (rls_can_read_all());

DROP POLICY IF EXISTS activities_read_all_app ON activities;
CREATE POLICY activities_read_all_app ON activities FOR SELECT USING (rls_can_read_all());

DROP POLICY IF EXISTS visits_read_all_app ON visits;
CREATE POLICY visits_read_all_app ON visits FOR SELECT USING (rls_can_read_all());

DROP POLICY IF EXISTS meetings_read_all_app ON meetings;
CREATE POLICY meetings_read_all_app ON meetings FOR SELECT USING (rls_can_read_all());

DROP POLICY IF EXISTS station_reports_read_all_app ON station_reports;
CREATE POLICY station_reports_read_all_app ON station_reports FOR SELECT USING (rls_can_read_all());

DROP POLICY IF EXISTS incidents_read_all_app ON incidents;
CREATE POLICY incidents_read_all_app ON incidents FOR SELECT USING (rls_can_read_all());

-- (3) Audit log = SUPER ADMIN (Dan / tech_lead) only, at the DB layer too. The app
--     page already restricts the all-users view to Dan by name; this makes the table
--     itself unreadable to everyone else (Tier-1 admins included), matching "Dan is
--     the only person with access to audit logs". Everyone still sees their OWN sign-ins
--     via the self-only sessions policy (unchanged). tech_lead is Dan alone.
DROP POLICY IF EXISTS audit_log_read_leadership ON audit_log;
DROP POLICY IF EXISTS audit_log_read_oversight ON audit_log;
DROP POLICY IF EXISTS audit_log_read_auditor ON audit_log;
CREATE POLICY audit_log_read_auditor ON audit_log FOR SELECT USING (rls_role() = 'tech_lead');
