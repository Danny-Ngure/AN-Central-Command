-- Alfayo Flames Crew roster + IEBC voter cross-match link.
-- See packages/db/src/schema/flames.ts.

DO $$ BEGIN
  CREATE TYPE "public"."flames_match_method" AS ENUM('phone', 'name', 'unmatched');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "flames_crew" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ward_id" uuid NOT NULL,
  "position" integer NOT NULL,
  "full_name" text NOT NULL,
  "raw_phone" text,
  "phone" text,
  "phone_tail" text,
  "voter_id" uuid,
  "match_method" "flames_match_method" DEFAULT 'unmatched' NOT NULL,
  "match_note" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "flames_crew_ward_position_unique" UNIQUE("ward_id","position")
);

DO $$ BEGIN
  ALTER TABLE "flames_crew" ADD CONSTRAINT "flames_crew_ward_id_wards_id_fk"
    FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "flames_crew" ADD CONSTRAINT "flames_crew_voter_id_voters_id_fk"
    FOREIGN KEY ("voter_id") REFERENCES "public"."voters"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "flames_crew_ward_idx" ON "flames_crew" ("ward_id");
CREATE INDEX IF NOT EXISTS "flames_crew_voter_idx" ON "flames_crew" ("voter_id");
CREATE INDEX IF NOT EXISTS "flames_crew_match_idx" ON "flames_crew" ("match_method");

-- Mirror the voters table posture: no per-row RLS, app_user gets table grants.
GRANT SELECT, INSERT, UPDATE, DELETE ON "flames_crew" TO app_user;
