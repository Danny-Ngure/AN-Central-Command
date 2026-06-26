-- Team members can be based in a village (app-layer FK to villages.id).
ALTER TABLE people ADD COLUMN IF NOT EXISTS home_village_id uuid;
CREATE INDEX IF NOT EXISTS people_home_village_idx ON people (home_village_id);

-- Roads: the MP's road projects, listed village → village. FKs to villages are
-- enforced at the app layer (nullable; a road may not yet be tied to a village).
CREATE TABLE IF NOT EXISTS roads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ward_id         uuid REFERENCES wards(id) ON DELETE SET NULL,
  from_village_id uuid,
  to_village_id   uuid,
  name            text NOT NULL,
  status          text,            -- proposed | ongoing | completed | stalled
  funding         text,            -- ng_cdf | county | national | other
  mp_project      boolean NOT NULL DEFAULT true,
  surface         text,            -- tarmac | murram | earth | cabro | graded
  length_km       numeric,
  notes           text,
  deleted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS roads_ward_idx ON roads (ward_id);
CREATE INDEX IF NOT EXISTS roads_from_idx ON roads (from_village_id);
CREATE INDEX IF NOT EXISTS roads_to_idx ON roads (to_village_id);
