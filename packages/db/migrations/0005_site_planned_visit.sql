-- Migration 0005 — Add planned_visit_at to community_sites.
-- When a site isn't visited yet, coordinators can set a target visit date so
-- the upcoming-visits roster has something to schedule against.

ALTER TABLE "community_sites" ADD COLUMN IF NOT EXISTS "planned_visit_at" timestamp with time zone;
