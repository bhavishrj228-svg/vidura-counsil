CREATE TABLE "rebuttals" (
	"id" text PRIMARY KEY,
	"report_id" text NOT NULL,
	"submitted_by" text NOT NULL,
	"explanation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" text PRIMARY KEY,
	"submitted_by" text NOT NULL,
	"message_text" text NOT NULL,
	"category" text NOT NULL,
	"city" text NOT NULL,
	"language" text NOT NULL,
	"extracted_domain" text,
	"phone_hash" text,
	"evidence_verdict" text DEFAULT 'pending' NOT NULL,
	"evidence_details" jsonb,
	"ai_status" text DEFAULT 'pending' NOT NULL,
	"ai_verdict" jsonb,
	"ai_started_at" timestamp with time zone,
	"status" text DEFAULT 'unverified' NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_as_scam" boolean,
	"reputation_settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"username" text NOT NULL UNIQUE,
	"reputation" real DEFAULT 1 NOT NULL,
	"reports_submitted" integer DEFAULT 0 NOT NULL,
	"reports_accurate" integer DEFAULT 0 NOT NULL,
	"votes_cast" integer DEFAULT 0 NOT NULL,
	"votes_accurate" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" text PRIMARY KEY,
	"report_id" text NOT NULL,
	"user_id" text NOT NULL,
	"vote_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "reports_created_at_idx" ON "reports" ("created_at");--> statement-breakpoint
CREATE INDEX "reports_phone_hash_idx" ON "reports" ("phone_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "votes_report_user_idx" ON "votes" ("report_id","user_id");--> statement-breakpoint
ALTER TABLE "rebuttals" ADD CONSTRAINT "rebuttals_report_id_reports_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id");--> statement-breakpoint
ALTER TABLE "rebuttals" ADD CONSTRAINT "rebuttals_submitted_by_users_id_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_submitted_by_users_id_fkey" FOREIGN KEY ("submitted_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_report_id_reports_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id");--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");