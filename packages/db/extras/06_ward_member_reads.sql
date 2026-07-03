-- ============================================================================
-- 06. Ordinary ward members can see EVERYTHING in their own ward
-- ============================================================================
--
-- Campaign direction: a member who logs in from a ward (e.g. a Canvasser in
-- Kadzandani) must see ALL of their own ward's materials — sites, community
-- leaders, issues, activities, visits, meetings, and their ward's team — plus the
-- full home page. They must NOT see other wards' data (the app navigation already
-- keeps them on Home + their own ward, and RLS returns nothing for other wards).
--
-- Root cause of the "locked out of sites" bug: the ward-scoped RLS predicate
-- rls_is_ward_scoped() did not include 'canvasser', so ordinary members matched no
-- read policy and saw an empty ward. Adding 'canvasser' fixes every ward table at
-- once (sites, leaders, issues, activities, visits, meetings, people-by-ward, …)
-- because they all key off this one function.
--
-- Idempotent: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION rls_is_ward_scoped() RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT current_setting('app.role', true) IN (
    'ward_coordinator', 'assistant_ward_coordinator',
    'influence_liaison', 'polling_station_lead', 'polling_agent',
    'canvasser'
  )
$$;
