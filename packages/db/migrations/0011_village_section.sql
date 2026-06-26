-- Village sections: an arbitrary-but-geographic grouping of a ward's villages
-- into a handful of named clusters (e.g. "Bamburi", "Bullo") for field planning,
-- coordinator assignment and per-section coverage. Free text; null = unassigned.
ALTER TABLE villages ADD COLUMN IF NOT EXISTS section text;

CREATE INDEX IF NOT EXISTS villages_ward_section_idx ON villages (ward_id, section);
