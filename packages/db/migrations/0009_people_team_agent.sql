-- Migration 0009 — Add team_id, agent_id, agent_station to people.
--
-- These three columns exist in the Drizzle schema
-- (packages/db/src/schema/identity.ts) but were never created by a migration.
-- Databases built purely from `pnpm db:migrate` therefore lack them, and because
-- Drizzle's `select().from(people)` lists EVERY schema column, the login and team
-- queries fail with: `column people.team_id does not exist`.
--
-- IF NOT EXISTS keeps this safe to re-run on databases that already have the
-- columns (e.g. ones previously synced with `drizzle-kit push`).
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "team_id" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "agent_id" text;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "agent_station" text;
