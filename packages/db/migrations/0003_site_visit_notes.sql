-- Migration 0003 — Add visit_notes column to community_sites.
-- Stores the ~100-word coordinator note recorded when a site is marked visited.
-- Hand-written; idempotent.

ALTER TABLE "community_sites" ADD COLUMN IF NOT EXISTS "visit_notes" text;
