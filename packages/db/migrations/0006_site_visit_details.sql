-- Migration 0006 — Structured visit/planning details on community_sites.
--
-- Pre-visit planning (filled when a coordinator schedules an upcoming visit):
--   planned_purpose, planned_objectives, planned_attendees
--
-- Post-visit assessment (filled when a coordinator logs a completed visit):
--   visit_promises      — what the campaign promised at the meeting
--   visit_benefits      — what we gave or offered (material, intro, support)
--   visit_response      — how the community received us
--   visit_temperature   — 'hot' | 'warm' | 'cold' (welcome reception)
--   visit_recommendation— 'high_priority' | 'normal' | 'low_priority' (revisit?)
--   visit_effort        — 'intensify' | 'maintain' | 'reduce'
--
-- These fields are required at the app layer before the visited flag flips on.

ALTER TABLE "community_sites" ADD COLUMN IF NOT EXISTS "visit_promises"       text;
ALTER TABLE "community_sites" ADD COLUMN IF NOT EXISTS "visit_benefits"       text;
ALTER TABLE "community_sites" ADD COLUMN IF NOT EXISTS "visit_response"       text;
ALTER TABLE "community_sites" ADD COLUMN IF NOT EXISTS "visit_temperature"    text;
ALTER TABLE "community_sites" ADD COLUMN IF NOT EXISTS "visit_recommendation" text;
ALTER TABLE "community_sites" ADD COLUMN IF NOT EXISTS "visit_effort"         text;
ALTER TABLE "community_sites" ADD COLUMN IF NOT EXISTS "planned_purpose"      text;
ALTER TABLE "community_sites" ADD COLUMN IF NOT EXISTS "planned_objectives"   text;
ALTER TABLE "community_sites" ADD COLUMN IF NOT EXISTS "planned_attendees"    text;
