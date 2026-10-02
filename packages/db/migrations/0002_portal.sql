CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"logo_upload_id" uuid,
	"accent_color" text DEFAULT '#2563EB' NOT NULL,
	"tagline" text,
	"website_url" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_workspace_slug_unique" UNIQUE("workspace_id","slug"),
	CONSTRAINT "products_slug_format" CHECK ("products"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("products"."slug") BETWEEN 2 AND 32),
	CONSTRAINT "products_accent_hex" CHECK ("products"."accent_color" ~ '^#[0-9A-F]{6}$')
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"logo_upload_id" uuid,
	"website_url" text,
	"directory_enabled" boolean DEFAULT true NOT NULL,
	"suspended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug"),
	CONSTRAINT "workspaces_slug_format" CHECK ("workspaces"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("workspaces"."slug") BETWEEN 2 AND 32)
);
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_logo_upload_id_uploads_id_fk" FOREIGN KEY ("logo_upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_logo_upload_id_uploads_id_fk" FOREIGN KEY ("logo_upload_id") REFERENCES "public"."uploads"("id") ON DELETE set null ON UPDATE no action;