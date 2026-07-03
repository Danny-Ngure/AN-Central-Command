-- ============================================================================
-- 05. "View everything" read access for leadership, ward reps & department heads
-- ============================================================================
--
-- Campaign direction: Ward Representatives, their Assistants, and Department Heads
-- can SEE everything in the app (read-only across all wards). They may still only
-- ADD/EDIT data within their own ward — write policies are unchanged, so this file
-- ONLY grants extra SELECT (read) access. Ordinary field members (canvassers,
-- polling agents, influence liaisons, etc.) keep their existing limited view and
-- are NOT included here.
--
-- These are additive PERMISSIVE policies: Postgres OR-combines them with the
-- existing per-ward / self policies, so nobody loses access and no write path
-- changes. Sensitive PII tables (committed_supporters, consent_log) are
-- deliberately EXCLUDED to preserve the DPA gates.
--
-- Idempotent: safe to re-run.

CREATE OR REPLACE FUNCTION rls_can_view_all() RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT current_setting('app.role', true) IN (
    -- constituency leadership
    'candidate', 'campaign_manager', 'chief_strategist', 'constituency_coordinator', 'tech_lead',
    -- ward representatives + their assistants
    'ward_coordinator', 'assistant_ward_coordinator',
    -- department heads
    'media_head', 'comms_head', 'finance_lead', 'patron_ceo'
  )
$$;

-- People directory — see every team member (and their duties).
DROP POLICY IF EXISTS people_read_viewall ON people;
CREATE POLICY people_read_viewall ON people FOR SELECT USING (rls_can_view_all());

-- Operational data — read across all wards.
DROP POLICY IF EXISTS sites_read_viewall ON community_sites;
CREATE POLICY sites_read_viewall ON community_sites FOR SELECT USING (rls_can_view_all());

DROP POLICY IF EXISTS leaders_read_viewall ON community_leaders;
CREATE POLICY leaders_read_viewall ON community_leaders FOR SELECT USING (rls_can_view_all());

DROP POLICY IF EXISTS issues_read_viewall ON village_issues;
CREATE POLICY issues_read_viewall ON village_issues FOR SELECT USING (rls_can_view_all());

DROP POLICY IF EXISTS activities_read_viewall ON activities;
CREATE POLICY activities_read_viewall ON activities FOR SELECT USING (rls_can_view_all());

DROP POLICY IF EXISTS visits_read_viewall ON visits;
CREATE POLICY visits_read_viewall ON visits FOR SELECT USING (rls_can_view_all());

DROP POLICY IF EXISTS meetings_read_viewall ON meetings;
CREATE POLICY meetings_read_viewall ON meetings FOR SELECT USING (rls_can_view_all());

DROP POLICY IF EXISTS programs_read_viewall ON community_programs;
CREATE POLICY programs_read_viewall ON community_programs FOR SELECT USING (rls_can_view_all());

DROP POLICY IF EXISTS station_reports_read_viewall ON station_reports;
CREATE POLICY station_reports_read_viewall ON station_reports FOR SELECT USING (rls_can_view_all());

DROP POLICY IF EXISTS incidents_read_viewall ON incidents;
CREATE POLICY incidents_read_viewall ON incidents FOR SELECT USING (rls_can_view_all());
