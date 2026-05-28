-- Row-Level Security policies (SRS FR-002, §2.2 role matrix).
--
-- Architecture
-- ============
-- Migrations, seeds, and direct psql sessions connect as the DB owner (e.g. `alfayo`
-- in local dev). As a Postgres superuser, they BYPASS RLS automatically — no policy
-- prevents migrations from running. Same for ad-hoc operations.
--
-- Application connections also authenticate as that DB owner, but each transaction
-- begins with `SET LOCAL ROLE app_user; SET LOCAL app.role = '<campaign role>'; ...`.
-- This drops superuser privileges for the transaction, making RLS apply, while
-- preserving the simple single-DB-user dev experience.
--
-- Session variables read by every policy:
--   app.role       — the active CampaignRole (SRS §2.2: 15 values)
--   app.ward_id    — the user's assigned ward (null for constituency-wide roles)
--   app.person_id  — the authenticated user's UUID
--
-- If app.role is null (no setRequestContext call), no permissive policy matches and
-- the user sees nothing. Safe default.
--
-- Patterns
-- ========
-- Leadership      = candidate, campaign_manager, chief_strategist, constituency_coordinator
-- Senior admin    = tech_lead (sees everything; subject to elevated audit logging)
-- Oversight       = patron_ceo (read-only across the platform)
-- Ward-scoped     = ward_coordinator, assistant_ward_coordinator, influence_liaison
-- Station-scoped  = polling_station_lead, polling_agent  (approximated as ward-scoped in MVP;
--                   true station-level scoping requires a polling_station_assignments table)
-- Self-only       = canvasser (sees own contacts/supporters), individual access to own session/auth
-- Excluded        = finance_lead has read on activities only; no access to voter/strategic data
--
-- Three special-case requirements baked in:
--   - community_leaders.sensitive_notes — restricted to candidate, campaign_manager,
--     chief_strategist, AND the owning person (BR-020.2). Row visibility doesn't restrict
--     columns; a follow-up migration adds a `community_leaders_view` that nulls the column
--     for unauthorised readers. RLS here only filters rows.
--   - committed_supporters — visible only to candidate, campaign_manager, chief_strategist,
--     constituency_coordinator, and the assigning ward_coordinator (AC-130.4). Other ward
--     coordinators do NOT see another ward's supporters.
--   - 404-not-403 on unauthorised reads of supporters (ERR-130.2) — implemented at the
--     API layer (a missing-row response indistinguishable from a denied row); RLS gives
--     the empty row set the API needs to map to 404.

-- ============================================================================
-- 1. app_user role, grants, default privileges
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- Future tables: default privileges.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- ============================================================================
-- 2. Helper functions — readable policy predicates
-- ============================================================================

CREATE OR REPLACE FUNCTION rls_role() RETURNS text
LANGUAGE sql STABLE
AS $$ SELECT current_setting('app.role', true) $$;

CREATE OR REPLACE FUNCTION rls_ward_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.ward_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION rls_person_id() RETURNS uuid
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.person_id', true), '')::uuid $$;

CREATE OR REPLACE FUNCTION rls_is_leadership() RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT rls_role() IN (
    'candidate', 'campaign_manager', 'chief_strategist',
    'constituency_coordinator', 'tech_lead'
  )
$$;

CREATE OR REPLACE FUNCTION rls_is_oversight() RETURNS boolean
LANGUAGE sql STABLE
AS $$ SELECT rls_role() = 'patron_ceo' $$;

CREATE OR REPLACE FUNCTION rls_is_ward_scoped() RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT rls_role() IN (
    'ward_coordinator', 'assistant_ward_coordinator',
    'influence_liaison', 'polling_station_lead', 'polling_agent'
  )
$$;

CREATE OR REPLACE FUNCTION rls_can_read_supporters() RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT rls_role() IN (
    'candidate', 'campaign_manager', 'chief_strategist', 'constituency_coordinator'
  )
$$;

-- ============================================================================
-- 3. Enable RLS on every domain table
-- ============================================================================

ALTER TABLE audit_log              ENABLE ROW LEVEL SECURITY;
ALTER TABLE people                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_credentials       ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE constituencies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE wards                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sub_locations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE villages               ENABLE ROW LEVEL SECURITY;
ALTER TABLE polling_stations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_sites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_leaders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE village_issues         ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities             ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_programs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE committed_supporters   ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents              ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing policies (idempotent re-apply).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename);
  END LOOP;
END
$$;

-- ============================================================================
-- 4. audit_log — read for leadership/oversight; insert open (triggers do it)
-- ============================================================================
-- UPDATE/DELETE separately blocked by extras/01 trigger.

CREATE POLICY audit_log_read_leadership ON audit_log FOR SELECT
  USING (rls_is_leadership());

CREATE POLICY audit_log_read_oversight ON audit_log FOR SELECT
  USING (rls_is_oversight());

CREATE POLICY audit_log_insert_any ON audit_log FOR INSERT
  WITH CHECK (rls_role() IS NOT NULL);

-- ============================================================================
-- 5. Identity: people, auth_credentials, sessions
-- ============================================================================

-- people: leadership/oversight see everyone; ward-scoped see their ward + leadership-grade
-- members; everyone sees themselves.
CREATE POLICY people_read_leadership ON people FOR SELECT
  USING (rls_is_leadership() OR rls_is_oversight());

CREATE POLICY people_read_self ON people FOR SELECT
  USING (id = rls_person_id());

CREATE POLICY people_read_ward ON people FOR SELECT
  USING (rls_is_ward_scoped() AND ward_id = rls_ward_id());

-- People management — leadership only.
CREATE POLICY people_write_leadership ON people FOR INSERT
  WITH CHECK (rls_is_leadership());
CREATE POLICY people_update_leadership ON people FOR UPDATE
  USING (rls_is_leadership()) WITH CHECK (rls_is_leadership());
CREATE POLICY people_delete_leadership ON people FOR DELETE
  USING (rls_role() IN ('campaign_manager', 'tech_lead'));

-- auth_credentials: self only, plus tech_lead for admin reset paths.
CREATE POLICY auth_self_all ON auth_credentials FOR ALL
  USING (person_id = rls_person_id())
  WITH CHECK (person_id = rls_person_id());
CREATE POLICY auth_tech_lead_all ON auth_credentials FOR ALL
  USING (rls_role() = 'tech_lead')
  WITH CHECK (rls_role() = 'tech_lead');

-- sessions: self only, plus admin revocation.
CREATE POLICY sessions_self_all ON sessions FOR ALL
  USING (person_id = rls_person_id())
  WITH CHECK (person_id = rls_person_id());
CREATE POLICY sessions_admin_revoke ON sessions FOR UPDATE
  USING (rls_role() IN ('campaign_manager', 'tech_lead'))
  WITH CHECK (rls_role() IN ('campaign_manager', 'tech_lead'));

-- ============================================================================
-- 6. Geography: reference data — readable by everyone authenticated; write = leadership
-- ============================================================================

CREATE POLICY constituencies_read_all ON constituencies FOR SELECT
  USING (rls_role() IS NOT NULL);
CREATE POLICY constituencies_write_leadership ON constituencies FOR ALL
  USING (rls_is_leadership()) WITH CHECK (rls_is_leadership());

CREATE POLICY wards_read_all ON wards FOR SELECT
  USING (rls_role() IS NOT NULL);
CREATE POLICY wards_write_leadership ON wards FOR ALL
  USING (rls_is_leadership()) WITH CHECK (rls_is_leadership());

CREATE POLICY sub_locations_read_all ON sub_locations FOR SELECT
  USING (rls_role() IS NOT NULL);
CREATE POLICY sub_locations_write_leadership ON sub_locations FOR ALL
  USING (rls_is_leadership()) WITH CHECK (rls_is_leadership());

-- Villages: read for all; insert/update by ward-scoped within their ward; delete only campaign_manager+
CREATE POLICY villages_read_all ON villages FOR SELECT
  USING (rls_role() IS NOT NULL);
CREATE POLICY villages_write_leadership ON villages FOR ALL
  USING (rls_is_leadership()) WITH CHECK (rls_is_leadership());
CREATE POLICY villages_write_ward ON villages FOR INSERT
  WITH CHECK (rls_is_ward_scoped() AND ward_id = rls_ward_id());
CREATE POLICY villages_update_ward ON villages FOR UPDATE
  USING (rls_is_ward_scoped() AND ward_id = rls_ward_id())
  WITH CHECK (rls_is_ward_scoped() AND ward_id = rls_ward_id());

CREATE POLICY polling_stations_read_all ON polling_stations FOR SELECT
  USING (rls_role() IS NOT NULL);
CREATE POLICY polling_stations_write_leadership ON polling_stations FOR ALL
  USING (rls_is_leadership()) WITH CHECK (rls_is_leadership());

-- ============================================================================
-- 7. Community: leaders, sites, issues
-- ============================================================================

-- community_leaders: leadership + oversight see everything; ward-scoped see their ward.
CREATE POLICY leaders_read_leadership ON community_leaders FOR SELECT
  USING (rls_is_leadership() OR rls_is_oversight());
CREATE POLICY leaders_read_ward ON community_leaders FOR SELECT
  USING (rls_is_ward_scoped() AND ward_id = rls_ward_id());
-- Owners (the team member that brought the leader into the system) always see their own.
CREATE POLICY leaders_read_owner ON community_leaders FOR SELECT
  USING (owned_by_person_id = rls_person_id());

CREATE POLICY leaders_insert_ward ON community_leaders FOR INSERT
  WITH CHECK (
    rls_is_leadership()
    OR (rls_is_ward_scoped() AND ward_id = rls_ward_id())
    OR (rls_role() = 'canvasser' AND is_queued_for_review = true)
  );
CREATE POLICY leaders_update_owner ON community_leaders FOR UPDATE
  USING (owned_by_person_id = rls_person_id() OR rls_is_leadership())
  WITH CHECK (owned_by_person_id = rls_person_id() OR rls_is_leadership());
CREATE POLICY leaders_delete_leadership ON community_leaders FOR DELETE
  USING (rls_role() IN ('campaign_manager', 'tech_lead'));

-- community_sites: same pattern as leaders.
CREATE POLICY sites_read_leadership ON community_sites FOR SELECT
  USING (rls_is_leadership() OR rls_is_oversight());
CREATE POLICY sites_read_ward ON community_sites FOR SELECT
  USING (rls_is_ward_scoped() AND ward_id = rls_ward_id());
CREATE POLICY sites_write_ward ON community_sites FOR INSERT
  WITH CHECK (rls_is_leadership() OR (rls_is_ward_scoped() AND ward_id = rls_ward_id()));
CREATE POLICY sites_update_ward ON community_sites FOR UPDATE
  USING (rls_is_leadership() OR (rls_is_ward_scoped() AND ward_id = rls_ward_id()))
  WITH CHECK (rls_is_leadership() OR (rls_is_ward_scoped() AND ward_id = rls_ward_id()));

-- village_issues: leadership + oversight see all; ward-scoped see their ward.
CREATE POLICY issues_read_leadership ON village_issues FOR SELECT
  USING (rls_is_leadership() OR rls_is_oversight());
CREATE POLICY issues_read_ward ON village_issues FOR SELECT
  USING (rls_is_ward_scoped() AND ward_id = rls_ward_id());
-- finance_lead is excluded (no policy matches them).
CREATE POLICY issues_insert ON village_issues FOR INSERT
  WITH CHECK (
    rls_is_leadership()
    OR (rls_is_ward_scoped() AND ward_id = rls_ward_id())
    OR (rls_role() = 'canvasser' AND verified = false)
  );
CREATE POLICY issues_update ON village_issues FOR UPDATE
  USING (rls_is_leadership() OR (rls_is_ward_scoped() AND ward_id = rls_ward_id()))
  WITH CHECK (rls_is_leadership() OR (rls_is_ward_scoped() AND ward_id = rls_ward_id()));

-- ============================================================================
-- 8. Activities, visits, meetings
-- ============================================================================

-- activities: leadership + oversight see all; ward-scoped see their ward (and constituency-wide
-- activities where ward_id IS NULL); media_head, comms_head, finance_lead see all activities (read).
CREATE POLICY activities_read_broad ON activities FOR SELECT
  USING (
    rls_is_leadership()
    OR rls_is_oversight()
    OR rls_role() IN ('media_head', 'comms_head', 'finance_lead')
  );
CREATE POLICY activities_read_ward ON activities FOR SELECT
  USING (
    rls_is_ward_scoped()
    AND (ward_id = rls_ward_id() OR ward_id IS NULL)
  );

CREATE POLICY activities_write_owner ON activities FOR ALL
  USING (owner_person_id = rls_person_id() OR rls_is_leadership())
  WITH CHECK (owner_person_id = rls_person_id() OR rls_is_leadership());

-- visits — append-only; broad read for leadership; self + ward-scoped see relevant slices.
CREATE POLICY visits_read_leadership ON visits FOR SELECT
  USING (rls_is_leadership() OR rls_is_oversight());
CREATE POLICY visits_read_self ON visits FOR SELECT
  USING (visiting_person_id = rls_person_id());
CREATE POLICY visits_read_ward ON visits FOR SELECT
  USING (
    rls_is_ward_scoped()
    AND village_id IN (SELECT id FROM villages WHERE ward_id = rls_ward_id())
  );

-- Anyone with a role can log a visit FOR THEMSELVES (visiting_person_id must match).
-- The append-only trigger in 01_ blocks UPDATE/DELETE regardless.
CREATE POLICY visits_insert_self ON visits FOR INSERT
  WITH CHECK (visiting_person_id = rls_person_id());

-- meetings: invitees + owner + leadership + media_head + comms_head.
CREATE POLICY meetings_read_leadership ON meetings FOR SELECT
  USING (
    rls_is_leadership()
    OR rls_is_oversight()
    OR rls_role() IN ('media_head', 'comms_head')
  );
CREATE POLICY meetings_read_owner ON meetings FOR SELECT
  USING (owner_person_id = rls_person_id());
CREATE POLICY meetings_read_invitee ON meetings FOR SELECT
  USING (rls_person_id() = ANY(invitee_person_ids));

CREATE POLICY meetings_write ON meetings FOR ALL
  USING (
    owner_person_id = rls_person_id()
    OR rls_is_leadership()
    OR rls_role() IN ('media_head', 'comms_head')
  )
  WITH CHECK (
    owner_person_id = rls_person_id()
    OR rls_is_leadership()
    OR rls_role() IN ('media_head', 'comms_head')
  );

-- ============================================================================
-- 9. Supporters (RESTRICTED) — strictest access control in the platform
-- ============================================================================

-- community_programs: visible to ward_coordinator+ and influence_liaison.
CREATE POLICY programs_read ON community_programs FOR SELECT
  USING (
    rls_is_leadership()
    OR rls_is_oversight()
    OR rls_is_ward_scoped()
  );
CREATE POLICY programs_write_leadership ON community_programs FOR ALL
  USING (rls_is_leadership()) WITH CHECK (rls_is_leadership());
CREATE POLICY programs_update_lead ON community_programs FOR UPDATE
  USING (lead_coordinator_person_id = rls_person_id())
  WITH CHECK (lead_coordinator_person_id = rls_person_id());

-- committed_supporters: SRS FR-130 AC-130.4 — visible only to:
--   - candidate, campaign_manager, chief_strategist, constituency_coordinator (any ward)
--   - the assigning ward_coordinator (their ward only — NOT other ward coordinators)
--   - the registering canvasser (only the supporters they themselves registered)
CREATE POLICY supporters_read_leadership ON committed_supporters FOR SELECT
  USING (rls_can_read_supporters());
CREATE POLICY supporters_read_ward_coordinator ON committed_supporters FOR SELECT
  USING (
    rls_role() IN ('ward_coordinator', 'assistant_ward_coordinator')
    AND ward_id = rls_ward_id()
  );
CREATE POLICY supporters_read_canvasser_own ON committed_supporters FOR SELECT
  USING (
    rls_role() = 'canvasser'
    AND registering_person_id = rls_person_id()
  );

CREATE POLICY supporters_insert ON committed_supporters FOR INSERT
  WITH CHECK (
    -- BR-130.1 enforces consent metadata at the column-NOT-NULL level (consent_capture_method,
    -- consent_captured_at). The registering person must be the current user.
    registering_person_id = rls_person_id()
    AND (
      rls_can_read_supporters()
      OR (
        rls_role() IN ('ward_coordinator', 'assistant_ward_coordinator')
        AND ward_id = rls_ward_id()
      )
      OR rls_role() = 'canvasser'  -- canvassers can register supporters they personally contacted
    )
  );
CREATE POLICY supporters_update_authorised ON committed_supporters FOR UPDATE
  USING (
    rls_can_read_supporters()
    OR (
      rls_role() IN ('ward_coordinator', 'assistant_ward_coordinator')
      AND ward_id = rls_ward_id()
    )
  )
  WITH CHECK (
    rls_can_read_supporters()
    OR (
      rls_role() IN ('ward_coordinator', 'assistant_ward_coordinator')
      AND ward_id = rls_ward_id()
    )
  );
-- Hard erasure (FR-134) goes through application code as an anonymisation update,
-- not a DELETE. Pure DELETE restricted to campaign_manager and tech_lead.
CREATE POLICY supporters_delete ON committed_supporters FOR DELETE
  USING (rls_role() IN ('campaign_manager', 'tech_lead'));

-- consent_log — append-only; readable by leadership and the actor that recorded it.
CREATE POLICY consent_log_read_leadership ON consent_log FOR SELECT
  USING (rls_can_read_supporters());
CREATE POLICY consent_log_read_actor ON consent_log FOR SELECT
  USING (actor_person_id = rls_person_id());
CREATE POLICY consent_log_insert ON consent_log FOR INSERT
  WITH CHECK (actor_person_id = rls_person_id() AND rls_role() IS NOT NULL);
-- UPDATE/DELETE blocked by extras/01.

-- ============================================================================
-- 10. Election-day: station_reports, incidents
-- ============================================================================

-- station_reports: leadership + oversight see all; ward-scoped see their ward's stations;
-- agents see their own reports; canvassers see nothing.
CREATE POLICY reports_read_leadership ON station_reports FOR SELECT
  USING (rls_is_leadership() OR rls_is_oversight());
CREATE POLICY reports_read_ward ON station_reports FOR SELECT
  USING (
    rls_is_ward_scoped()
    AND polling_station_id IN (SELECT id FROM polling_stations WHERE ward_id = rls_ward_id())
  );
CREATE POLICY reports_read_agent_self ON station_reports FOR SELECT
  USING (agent_person_id = rls_person_id());

-- INSERT — agents submit for themselves; ward leads can submit too.
CREATE POLICY reports_insert ON station_reports FOR INSERT
  WITH CHECK (
    agent_person_id = rls_person_id()
    AND rls_role() IN (
      'polling_agent', 'polling_station_lead',
      'ward_coordinator', 'assistant_ward_coordinator',
      'constituency_coordinator', 'campaign_manager', 'tech_lead'
    )
  );
-- UPDATE/DELETE blocked by extras/01.

-- incidents: leadership + oversight see all; ward-scoped see their ward's stations.
CREATE POLICY incidents_read_leadership ON incidents FOR SELECT
  USING (rls_is_leadership() OR rls_is_oversight());
CREATE POLICY incidents_read_ward ON incidents FOR SELECT
  USING (
    rls_is_ward_scoped()
    AND polling_station_id IN (SELECT id FROM polling_stations WHERE ward_id = rls_ward_id())
  );

CREATE POLICY incidents_insert ON incidents FOR INSERT
  WITH CHECK (
    reported_by_person_id = rls_person_id()
    AND rls_role() IN (
      'polling_agent', 'polling_station_lead',
      'ward_coordinator', 'assistant_ward_coordinator',
      'constituency_coordinator', 'campaign_manager', 'chief_strategist',
      'tech_lead', 'candidate'
    )
  );
-- Incident status updates: ward-scoped+ can update; finance_lead excluded.
CREATE POLICY incidents_update ON incidents FOR UPDATE
  USING (
    rls_is_leadership()
    OR (rls_is_ward_scoped() AND polling_station_id IN (
      SELECT id FROM polling_stations WHERE ward_id = rls_ward_id()
    ))
  )
  WITH CHECK (
    rls_is_leadership()
    OR (rls_is_ward_scoped() AND polling_station_id IN (
      SELECT id FROM polling_stations WHERE ward_id = rls_ward_id()
    ))
  );
