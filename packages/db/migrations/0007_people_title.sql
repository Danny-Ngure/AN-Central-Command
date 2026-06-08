-- Migration 0007 — Add title text column to people.
-- Free-text job title alongside the role enum. Examples:
--   role='campaign_manager' → title='Director of Programs' (Cavins)
--                            title='Assistant Campaign Director' (Arnold)
--   role='ward_coordinator' → title='Ward Representative'
--   role='candidate'        → title='Patron / Aspirant'
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "title" text;
