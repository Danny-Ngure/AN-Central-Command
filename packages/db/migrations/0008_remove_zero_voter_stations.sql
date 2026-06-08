-- 0008_remove_zero_voter_stations.sql
-- Purpose: clean up polling stations that have ZERO voters in the imported voter list.
--
-- Background: the original seed loaded 2 placeholder stations per ward (clean IEBC
-- codes 028-001..028-042) carrying historical turnout %. The real voter import then
-- auto-created stations from the voter file's POLLING STATION column (hash-suffixed
-- codes) and attached all actual voters to THOSE. Result: the seed stations show 0
-- imported voters, and several are exact duplicates of an imported station.
--
-- Strategy (mirrors lib/dedup-stations.ts):
--   A. MERGE 4 duplicates  -> move the imported station's voters onto the seed row
--      (keeps the seed's canonical IEBC code + turnout history), adopt the imported
--      name, recompute registered_voters, then delete the now-empty imported row.
--   B. DELETE 5 orphan seed placeholders -> no voters, no twin, no field reports.
--   C. DEACTIVATE 1 orphan ("Frere Town Community Hall") -> it has append-only
--      station_reports + an incident (audit-protected, cannot be deleted), so it is
--      marked inactive and filtered out of the UI instead.
--
-- A row-level backup was taken to tools/backups/ before applying.

BEGIN;

-- ── A. Merge the 4 duplicate pairs (seed_code keeps code+turnout; imp_code deleted)
DO $$
DECLARE
  pair RECORD;
  seed_id uuid;
  imp_id  uuid;
  imp_name text;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('028-031', '028-a7340f96'),  -- Frere Town Primary  <- FRERE TOWN PRIMARY SCHOOL
      ('028-001', '028-a825e7d3'),  -- Kadzandani Primary  <- KADZANDANI PRIMARY SCHOOL
      ('028-011', '028-e8aa8000'),  -- Kongowea Primary    <- KONGOWEA PRIMARY SCHOOL
      ('028-041', '028-0cc73796')   -- Ziwa Primary        <- ZIWA LA NG'OMBE PRIMARY SCHOOL
    ) AS t(seed_code, imp_code)
  LOOP
    SELECT id INTO seed_id FROM polling_stations WHERE iebc_code = pair.seed_code;
    SELECT id, name INTO imp_id, imp_name FROM polling_stations WHERE iebc_code = pair.imp_code;
    IF seed_id IS NULL OR imp_id IS NULL THEN
      RAISE NOTICE 'skip pair % / % (already merged?)', pair.seed_code, pair.imp_code;
      CONTINUE;
    END IF;

    -- move voters from imported row onto the seed row
    UPDATE voters SET polling_station_id = seed_id WHERE polling_station_id = imp_id;

    -- seed row adopts canonical name + real registered count (keeps its code + turnout)
    UPDATE polling_stations
       SET name = imp_name,
           registered_voters = (SELECT count(*) FROM voters v WHERE v.polling_station_id = seed_id),
           updated_at = now()
     WHERE id = seed_id;

    -- delete the now-empty imported duplicate
    DELETE FROM polling_stations WHERE id = imp_id;
  END LOOP;
END $$;

-- ── B. Delete 5 orphan seed placeholders (0 voters, no twin, no field reports)
DELETE FROM polling_stations
 WHERE iebc_code IN ('028-002','028-012','028-021','028-022','028-042');

-- ── C. Deactivate the one orphan that has audit-protected field reports/incident
UPDATE polling_stations
   SET active = false, updated_at = now()
 WHERE iebc_code = '028-032';

COMMIT;
