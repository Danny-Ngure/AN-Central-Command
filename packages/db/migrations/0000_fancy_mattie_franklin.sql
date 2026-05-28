CREATE TABLE IF NOT EXISTS "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"actor_person_id" uuid,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"before_value" jsonb,
	"after_value" jsonb,
	"ip_address" "inet",
	"context" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "constituencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iebc_code" text NOT NULL,
	"name" text NOT NULL,
	"county_name" text NOT NULL,
	"registered_voters" integer,
	"boundary" geometry(MultiPolygon, 4326),
	"centroid" geometry(Point, 4326),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "constituencies_iebc_code_unique" UNIQUE("iebc_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "polling_stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ward_id" uuid NOT NULL,
	"sub_location_id" uuid,
	"iebc_code" text NOT NULL,
	"name" text NOT NULL,
	"location" geometry(Point, 4326) NOT NULL,
	"registered_voters" integer NOT NULL,
	"turnout_2013" integer,
	"turnout_2017" integer,
	"turnout_2022" integer,
	"margin_2022" integer,
	"target_turnout" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "polling_stations_iebc_code_unique" UNIQUE("iebc_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sub_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ward_id" uuid NOT NULL,
	"name" text NOT NULL,
	"boundary" geometry(MultiPolygon, 4326),
	"centroid" geometry(Point, 4326),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sub_locations_ward_name_unique" UNIQUE("ward_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "villages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ward_id" uuid NOT NULL,
	"sub_location_id" uuid,
	"name" text NOT NULL,
	"aliases" text[],
	"boundary" geometry(Polygon, 4326),
	"centroid" geometry(Point, 4326) NOT NULL,
	"population_estimate" integer,
	"assigned_coordinator_person_id" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "villages_ward_name_unique" UNIQUE("ward_id","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"constituency_id" uuid NOT NULL,
	"iebc_code" text NOT NULL,
	"name" text NOT NULL,
	"registered_voters" integer,
	"population_estimate" integer,
	"boundary" geometry(MultiPolygon, 4326),
	"centroid" geometry(Point, 4326),
	"top_issue_category" text,
	"coverage_percent" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wards_iebc_code_unique" UNIQUE("iebc_code")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "polling_stations" ADD CONSTRAINT "polling_stations_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "polling_stations" ADD CONSTRAINT "polling_stations_sub_location_id_sub_locations_id_fk" FOREIGN KEY ("sub_location_id") REFERENCES "public"."sub_locations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sub_locations" ADD CONSTRAINT "sub_locations_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "villages" ADD CONSTRAINT "villages_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "villages" ADD CONSTRAINT "villages_sub_location_id_sub_locations_id_fk" FOREIGN KEY ("sub_location_id") REFERENCES "public"."sub_locations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wards" ADD CONSTRAINT "wards_constituency_id_constituencies_id_fk" FOREIGN KEY ("constituency_id") REFERENCES "public"."constituencies"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "polling_stations_ward_idx" ON "polling_stations" USING btree ("ward_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "polling_stations_location_idx" ON "polling_stations" USING gist ("location");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sub_locations_ward_idx" ON "sub_locations" USING btree ("ward_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "villages_ward_idx" ON "villages" USING btree ("ward_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "villages_centroid_idx" ON "villages" USING gist ("centroid");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wards_constituency_idx" ON "wards" USING btree ("constituency_id");