CREATE TABLE "aas_daily_goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"artist_id" integer NOT NULL,
	"cycle_date" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_count" integer DEFAULT 1 NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"agent" text,
	"channel" text,
	"priority" integer DEFAULT 3,
	"result" text,
	"metadata" json,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_global_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" text NOT NULL,
	"description" text,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_global_settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE "admin_pricing_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"operation_type" text NOT NULL,
	"category" text NOT NULL,
	"internal_cost_usd" numeric(10, 6) NOT NULL,
	"markup_multiplier" numeric(5, 2) DEFAULT '5.00' NOT NULL,
	"credit_cost" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_pricing_config_operation_type_unique" UNIQUE("operation_type")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "page_mode" text DEFAULT 'artist';--> statement-breakpoint
ALTER TABLE "aas_daily_goals" ADD CONSTRAINT "aas_daily_goals_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_aas_goals_artist_date" ON "aas_daily_goals" USING btree ("artist_id","cycle_date");--> statement-breakpoint
CREATE INDEX "idx_aas_goals_status" ON "aas_daily_goals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_aas_goals_category" ON "aas_daily_goals" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_admin_pricing_operation" ON "admin_pricing_config" USING btree ("operation_type");--> statement-breakpoint
CREATE INDEX "idx_admin_pricing_category" ON "admin_pricing_config" USING btree ("category");