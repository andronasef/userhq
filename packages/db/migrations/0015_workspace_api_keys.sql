CREATE TABLE "workspace_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"product_restrictions" jsonb,
	"created_by_user_id" text,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "created_by_api_key_id" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "created_by_api_key_id" uuid;--> statement-breakpoint
ALTER TABLE "workspace_api_keys" ADD CONSTRAINT "workspace_api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_api_keys" ADD CONSTRAINT "workspace_api_keys_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_api_keys_workspace_id_idx" ON "workspace_api_keys" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_api_keys_key_hash_idx" ON "workspace_api_keys" USING btree ("key_hash");--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_created_by_api_key_id_workspace_api_keys_id_fk" FOREIGN KEY ("created_by_api_key_id") REFERENCES "public"."workspace_api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_created_by_api_key_id_workspace_api_keys_id_fk" FOREIGN KEY ("created_by_api_key_id") REFERENCES "public"."workspace_api_keys"("id") ON DELETE set null ON UPDATE no action;