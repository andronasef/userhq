CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin');--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "member_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_members_one_owner" ON "workspace_members" USING btree ("workspace_id") WHERE "workspace_members"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "workspace_members_user_idx" ON "workspace_members" USING btree ("user_id");