-- Migration 0004 — Add area_name to community_sites.
-- Free-text human-readable location ("KWA BULLO", "KADZANDANI", "MWATAMBA") as
-- it appears on coordinator-supplied PDFs. Independent of the village FK + GPS.

ALTER TABLE "community_sites" ADD COLUMN IF NOT EXISTS "area_name" text;
