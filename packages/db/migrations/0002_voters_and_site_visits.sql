-- Migration 0002 — voter register + community-site visit tracking.
--
-- Hand-written (matching the Drizzle schema edits in voters.ts + community.ts).
-- Idempotent guards (IF NOT EXISTS) so re-running on a partially-applied DB is safe.

-- ---- ENUMS ----------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "public"."voter_gender" AS ENUM('M', 'F', 'U');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."voter_registration_source" AS ENUM('iebc_register', 'campaign_collected', 'public_event', 'unknown');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- ---- VOTERS ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "voters" (
  "id"                   uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "voter_number"         text NOT NULL,
  "national_id"          text,
  "surname"              text NOT NULL,
  "first_name"           text NOT NULL,
  "date_of_birth"        date,
  "gender"               "voter_gender" DEFAULT 'U' NOT NULL,
  "county"               text DEFAULT 'Mombasa' NOT NULL,
  "constituency"         text DEFAULT 'Nyali' NOT NULL,
  "ward_id"              uuid NOT NULL,
  "polling_station_id"   uuid,
  "phone"                text,
  "phone_tail"           text,
  "registration_source"  "voter_registration_source" DEFAULT 'iebc_register' NOT NULL,
  "consent_withdrawn_at" timestamp with time zone,
  "opted_out_of_contact" timestamp with time zone,
  "created_at"           timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"           timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "voters_voter_number_unique" UNIQUE ("voter_number")
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "voters" ADD CONSTRAINT "voters_ward_id_wards_id_fk"
    FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "voters" ADD CONSTRAINT "voters_polling_station_id_polling_stations_id_fk"
    FOREIGN KEY ("polling_station_id") REFERENCES "public"."polling_stations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "voters_ward_idx"            ON "voters" USING btree ("ward_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voters_polling_station_idx" ON "voters" USING btree ("polling_station_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voters_surname_idx"         ON "voters" USING btree ("surname");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voters_gender_idx"          ON "voters" USING btree ("gender");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voters_dob_idx"             ON "voters" USING btree ("date_of_birth");
--> statement-breakpoint

-- ---- COMMUNITY_SITES extras -----------------------------------------------

ALTER TABLE "community_sites" ADD COLUMN IF NOT EXISTS "contact_person_name" text;
--> statement-breakpoint
ALTER TABLE "community_sites" ADD COLUMN IF NOT EXISTS "contact_phone"       text;
--> statement-breakpoint
ALTER TABLE "community_sites" ADD COLUMN IF NOT EXISTS "contact_role"        text;
--> statement-breakpoint
ALTER TABLE "community_sites" ADD COLUMN IF NOT EXISTS "visited"             boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "community_sites" ADD COLUMN IF NOT EXISTS "visited_at"          timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "community_sites" ADD COLUMN IF NOT EXISTS "visited_by_person_id" uuid;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "community_sites_visited_idx" ON "community_sites" USING btree ("ward_id", "visited");
