CREATE TYPE "public"."campaign_role" AS ENUM('candidate', 'campaign_manager', 'chief_strategist', 'constituency_coordinator', 'media_head', 'comms_head', 'patron_ceo', 'ward_coordinator', 'assistant_ward_coordinator', 'polling_station_lead', 'polling_agent', 'canvasser', 'influence_liaison', 'tech_lead', 'finance_lead');--> statement-breakpoint
CREATE TYPE "public"."influence_reach" AS ENUM('small', 'medium', 'large', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."issue_severity" AS ENUM('minor', 'moderate', 'serious', 'critical');--> statement-breakpoint
CREATE TYPE "public"."issue_status" AS ENUM('reported', 'investigating', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."political_lean" AS ENUM('supportive', 'leaning_supportive', 'neutral', 'leaning_opposition', 'opposition', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."relationship_temperature" AS ENUM('warm', 'cool', 'cold', 'hostile', 'not_approached');--> statement-breakpoint
CREATE TYPE "public"."activity_status" AS ENUM('planned', 'confirmed', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('scheduled', 'confirmed', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."meeting_type" AS ENUM('internal_strategy', 'community_baraza', 'stakeholder', 'condolence_visit', 'harambee', 'courtesy_call', 'media');--> statement-breakpoint
CREATE TYPE "public"."commitment_tier" AS ENUM('strong_commit', 'likely', 'probable', 'unverified');--> statement-breakpoint
CREATE TYPE "public"."consent_capture_method" AS ENUM('verbal_witnessed', 'written_signed', 'sms_confirmed', 'in_person_app');--> statement-breakpoint
CREATE TYPE "public"."consent_event_type" AS ENUM('capture', 're_verification', 'withdrawal');--> statement-breakpoint
CREATE TYPE "public"."incident_category" AS ENUM('voter_intimidation', 'agent_obstruction', 'ballot_issue', 'materials_shortage', 'violence', 'dispute', 'technical_failure', 'other');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('reported', 'investigating', 'resolved', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."report_source" AS ENUM('app', 'sms');--> statement-breakpoint
CREATE TYPE "public"."station_report_type" AS ENUM('check_in', 'hourly_turnout', 'materials_status', 'closing_count');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"password_hash" text NOT NULL,
	"totp_secret" text,
	"totp_enrolled_at" timestamp with time zone,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_credentials_person_unique" UNIQUE("person_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"national_id" text,
	"full_name" text NOT NULL,
	"role" "campaign_role" NOT NULL,
	"ward_id" uuid,
	"photo_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"last_active_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_phone_unique" UNIQUE("phone"),
	CONSTRAINT "people_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"token" text NOT NULL,
	"device_fingerprint" text,
	"ip_address" "inet",
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_leaders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"whatsapp_phone" text,
	"email" text,
	"role_title" text NOT NULL,
	"affiliated_site_id" uuid,
	"village_id" uuid NOT NULL,
	"ward_id" uuid NOT NULL,
	"influence_reach" "influence_reach" DEFAULT 'unknown' NOT NULL,
	"political_lean" "political_lean" DEFAULT 'unknown' NOT NULL,
	"relationship_temperature" "relationship_temperature" DEFAULT 'not_approached' NOT NULL,
	"owned_by_person_id" uuid NOT NULL,
	"sensitive_notes" text,
	"is_queued_for_review" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"location" geometry(Point, 4326) NOT NULL,
	"ward_id" uuid NOT NULL,
	"village_id" uuid,
	"estimated_size" integer,
	"meeting_schedule" text,
	"key_contact_leader_id" uuid,
	"political_climate" text,
	"last_visited_at" timestamp with time zone,
	"visit_history_count" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "village_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"village_id" uuid NOT NULL,
	"ward_id" uuid NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" "issue_severity" NOT NULL,
	"affects_estimated_voters" integer,
	"status" "issue_status" DEFAULT 'reported' NOT NULL,
	"admin_responsiveness" text,
	"candidate_position" text,
	"verified" boolean DEFAULT false NOT NULL,
	"last_verified_at" date,
	"reported_by_person_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"location_name" text,
	"location_coords" geometry(Point, 4326),
	"ward_id" uuid,
	"village_id" uuid,
	"owner_person_id" uuid NOT NULL,
	"status" "activity_status" DEFAULT 'planned' NOT NULL,
	"expected_attendance" integer,
	"actual_attendance" integer,
	"candidate_attended" boolean DEFAULT false NOT NULL,
	"outcome_notes" text,
	"follow_up_required" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"type" "meeting_type" NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"location" text,
	"agenda" text,
	"owner_person_id" uuid NOT NULL,
	"status" "meeting_status" DEFAULT 'scheduled' NOT NULL,
	"invitee_person_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"stakeholder_notified_person_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"outcome_notes" text,
	"outcome_flagged_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "visits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"visiting_person_id" uuid NOT NULL,
	"location" geometry(Point, 4326) NOT NULL,
	"village_id" uuid,
	"purpose" text NOT NULL,
	"engagement_count" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "committed_supporters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"national_id_masked" text,
	"phone" text,
	"polling_station_id" uuid NOT NULL,
	"ward_id" uuid NOT NULL,
	"village_id" uuid,
	"community_program_id" uuid NOT NULL,
	"commitment_tier" "commitment_tier" NOT NULL,
	"registering_person_id" uuid NOT NULL,
	"consent_capture_method" "consent_capture_method" NOT NULL,
	"consent_captured_at" timestamp with time zone NOT NULL,
	"last_verified_date" date NOT NULL,
	"withdrawn" boolean DEFAULT false NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "community_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"ward_scope" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"village_scope" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"lead_coordinator_person_id" uuid NOT NULL,
	"estimated_beneficiary_count" integer,
	"started_at" date NOT NULL,
	"ended_at" date,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "consent_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supporter_id" uuid NOT NULL,
	"event_type" "consent_event_type" NOT NULL,
	"method" "consent_capture_method",
	"actor_person_id" uuid NOT NULL,
	"request_source" text,
	"outcome_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"polling_station_id" uuid NOT NULL,
	"reported_by_person_id" uuid NOT NULL,
	"category" "incident_category" NOT NULL,
	"severity" "issue_severity" NOT NULL,
	"description" text NOT NULL,
	"photo_url" text,
	"location" geometry(Point, 4326),
	"status" "incident_status" DEFAULT 'reported' NOT NULL,
	"escalated_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolution_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "station_reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"polling_station_id" uuid NOT NULL,
	"agent_person_id" uuid NOT NULL,
	"report_type" "station_report_type" NOT NULL,
	"turnout_count" integer,
	"notes" text,
	"source" "report_source" DEFAULT 'app' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "auth_credentials" ADD CONSTRAINT "auth_credentials_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "people" ADD CONSTRAINT "people_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_leaders" ADD CONSTRAINT "community_leaders_affiliated_site_id_community_sites_id_fk" FOREIGN KEY ("affiliated_site_id") REFERENCES "public"."community_sites"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_leaders" ADD CONSTRAINT "community_leaders_village_id_villages_id_fk" FOREIGN KEY ("village_id") REFERENCES "public"."villages"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_leaders" ADD CONSTRAINT "community_leaders_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_leaders" ADD CONSTRAINT "community_leaders_owned_by_person_id_people_id_fk" FOREIGN KEY ("owned_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_sites" ADD CONSTRAINT "community_sites_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_sites" ADD CONSTRAINT "community_sites_village_id_villages_id_fk" FOREIGN KEY ("village_id") REFERENCES "public"."villages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "village_issues" ADD CONSTRAINT "village_issues_village_id_villages_id_fk" FOREIGN KEY ("village_id") REFERENCES "public"."villages"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "village_issues" ADD CONSTRAINT "village_issues_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "village_issues" ADD CONSTRAINT "village_issues_reported_by_person_id_people_id_fk" FOREIGN KEY ("reported_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_village_id_villages_id_fk" FOREIGN KEY ("village_id") REFERENCES "public"."villages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_owner_person_id_people_id_fk" FOREIGN KEY ("owner_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "meetings" ADD CONSTRAINT "meetings_owner_person_id_people_id_fk" FOREIGN KEY ("owner_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visits" ADD CONSTRAINT "visits_visiting_person_id_people_id_fk" FOREIGN KEY ("visiting_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visits" ADD CONSTRAINT "visits_village_id_villages_id_fk" FOREIGN KEY ("village_id") REFERENCES "public"."villages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "committed_supporters" ADD CONSTRAINT "committed_supporters_polling_station_id_polling_stations_id_fk" FOREIGN KEY ("polling_station_id") REFERENCES "public"."polling_stations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "committed_supporters" ADD CONSTRAINT "committed_supporters_ward_id_wards_id_fk" FOREIGN KEY ("ward_id") REFERENCES "public"."wards"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "committed_supporters" ADD CONSTRAINT "committed_supporters_village_id_villages_id_fk" FOREIGN KEY ("village_id") REFERENCES "public"."villages"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "committed_supporters" ADD CONSTRAINT "committed_supporters_community_program_id_community_programs_id_fk" FOREIGN KEY ("community_program_id") REFERENCES "public"."community_programs"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "committed_supporters" ADD CONSTRAINT "committed_supporters_registering_person_id_people_id_fk" FOREIGN KEY ("registering_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "community_programs" ADD CONSTRAINT "community_programs_lead_coordinator_person_id_people_id_fk" FOREIGN KEY ("lead_coordinator_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consent_log" ADD CONSTRAINT "consent_log_supporter_id_committed_supporters_id_fk" FOREIGN KEY ("supporter_id") REFERENCES "public"."committed_supporters"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "consent_log" ADD CONSTRAINT "consent_log_actor_person_id_people_id_fk" FOREIGN KEY ("actor_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "incidents" ADD CONSTRAINT "incidents_polling_station_id_polling_stations_id_fk" FOREIGN KEY ("polling_station_id") REFERENCES "public"."polling_stations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reported_by_person_id_people_id_fk" FOREIGN KEY ("reported_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "station_reports" ADD CONSTRAINT "station_reports_polling_station_id_polling_stations_id_fk" FOREIGN KEY ("polling_station_id") REFERENCES "public"."polling_stations"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "station_reports" ADD CONSTRAINT "station_reports_agent_person_id_people_id_fk" FOREIGN KEY ("agent_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "people_ward_idx" ON "people" USING btree ("ward_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "people_role_idx" ON "people" USING btree ("role");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_person_idx" ON "sessions" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_leaders_ward_idx" ON "community_leaders" USING btree ("ward_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_leaders_village_idx" ON "community_leaders" USING btree ("village_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_leaders_owner_idx" ON "community_leaders" USING btree ("owned_by_person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_leaders_queue_idx" ON "community_leaders" USING btree ("is_queued_for_review");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_sites_ward_idx" ON "community_sites" USING btree ("ward_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_sites_location_idx" ON "community_sites" USING gist ("location");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_sites_type_idx" ON "community_sites" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "village_issues_village_idx" ON "village_issues" USING btree ("village_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "village_issues_ward_idx" ON "village_issues" USING btree ("ward_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "village_issues_category_idx" ON "village_issues" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "village_issues_severity_status_idx" ON "village_issues" USING btree ("severity","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_scheduled_idx" ON "activities" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_owner_idx" ON "activities" USING btree ("owner_person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_ward_idx" ON "activities" USING btree ("ward_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_status_idx" ON "activities" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meetings_scheduled_idx" ON "meetings" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meetings_owner_idx" ON "meetings" USING btree ("owner_person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meetings_status_idx" ON "meetings" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visits_person_idx" ON "visits" USING btree ("visiting_person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visits_village_idx" ON "visits" USING btree ("village_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visits_created_idx" ON "visits" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "visits_location_idx" ON "visits" USING gist ("location");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "committed_supporters_polling_station_idx" ON "committed_supporters" USING btree ("polling_station_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "committed_supporters_ward_idx" ON "committed_supporters" USING btree ("ward_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "committed_supporters_program_idx" ON "committed_supporters" USING btree ("community_program_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "committed_supporters_registering_idx" ON "committed_supporters" USING btree ("registering_person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "committed_supporters_tier_idx" ON "committed_supporters" USING btree ("commitment_tier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "committed_supporters_withdrawn_idx" ON "committed_supporters" USING btree ("withdrawn");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_programs_type_idx" ON "community_programs" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "community_programs_coordinator_idx" ON "community_programs" USING btree ("lead_coordinator_person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consent_log_supporter_idx" ON "consent_log" USING btree ("supporter_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consent_log_event_type_idx" ON "consent_log" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "consent_log_created_idx" ON "consent_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incidents_station_idx" ON "incidents" USING btree ("polling_station_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incidents_severity_status_idx" ON "incidents" USING btree ("severity","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "incidents_created_idx" ON "incidents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "station_reports_station_created_idx" ON "station_reports" USING btree ("polling_station_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "station_reports_agent_idx" ON "station_reports" USING btree ("agent_person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "station_reports_type_idx" ON "station_reports" USING btree ("report_type");