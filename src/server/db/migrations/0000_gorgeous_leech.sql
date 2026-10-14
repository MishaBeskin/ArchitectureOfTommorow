CREATE TYPE "public"."project_phase" AS ENUM('concept', 'in-progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('residential', 'commercial', 'cultural', 'civic', 'education', 'hospitality', 'mixed-use', 'landscape', 'infrastructure');--> statement-breakpoint
CREATE TABLE "architects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"website_url" text,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "architects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"message" text NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"handled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "contact_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "project_architects" (
	"project_id" uuid NOT NULL,
	"architect_id" uuid NOT NULL,
	"role" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "project_architects_project_id_architect_id_pk" PRIMARY KEY("project_id","architect_id")
);
--> statement-breakpoint
ALTER TABLE "project_architects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "project_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"url" text NOT NULL,
	"pathname" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"alt" text NOT NULL,
	"caption" text,
	"credit" text,
	"blur_data_url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_images_dimensions_positive" CHECK ("project_images"."width" > 0 AND "project_images"."height" > 0)
);
--> statement-breakpoint
ALTER TABLE "project_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "project_slug_redirects" (
	"old_slug" text PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_slug_redirects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"description_md" text DEFAULT '' NOT NULL,
	"type" "project_type" NOT NULL,
	"phase" "project_phase" DEFAULT 'completed' NOT NULL,
	"year" integer NOT NULL,
	"city" text NOT NULL,
	"region" text,
	"country_code" char(2) NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"cover_image_id" uuid,
	"featured" boolean DEFAULT false NOT NULL,
	"featured_order" integer,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_year_range" CHECK ("projects"."year" BETWEEN 1900 AND 2100),
	CONSTRAINT "projects_summary_length" CHECK (char_length("projects"."summary") <= 300),
	CONSTRAINT "projects_country_code_upper" CHECK ("projects"."country_code" = upper("projects"."country_code"))
);
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_architects" ADD CONSTRAINT "project_architects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_architects" ADD CONSTRAINT "project_architects_architect_id_architects_id_fk" FOREIGN KEY ("architect_id") REFERENCES "public"."architects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_images" ADD CONSTRAINT "project_images_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_slug_redirects" ADD CONSTRAINT "project_slug_redirects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_cover_image_id_project_images_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."project_images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "architects_slug_key" ON "architects" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "contact_messages_created_idx" ON "contact_messages" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "project_images_project_order_idx" ON "project_images" USING btree ("project_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug_key" ON "projects" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "projects_status_year_idx" ON "projects" USING btree ("status","year" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "projects_status_type_idx" ON "projects" USING btree ("status","type");--> statement-breakpoint
CREATE INDEX "projects_status_country_idx" ON "projects" USING btree ("status","country_code");--> statement-breakpoint
CREATE INDEX "projects_featured_order_idx" ON "projects" USING btree ("featured_order") WHERE "projects"."featured" AND "projects"."status" = 'published';