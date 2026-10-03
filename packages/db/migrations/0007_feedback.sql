CREATE TYPE "public"."email_batch_status" AS ENUM('pending', 'sending', 'retrying', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."post_activity_kind" AS ENUM('status_changed');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_id_product_unique" UNIQUE("id","product_id")
);
--> statement-breakpoint
CREATE TABLE "comment_email_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"status" "email_batch_status" DEFAULT 'pending' NOT NULL,
	"send_after" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comment_email_items" (
	"batch_id" uuid NOT NULL,
	"comment_id" uuid NOT NULL,
	CONSTRAINT "comment_email_items_batch_id_comment_id_pk" PRIMARY KEY("batch_id","comment_id")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"parent_id" uuid,
	"author_id" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"body" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comments_id_post_unique" UNIQUE("id","post_id")
);
--> statement-breakpoint
CREATE TABLE "post_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"kind" "post_activity_kind" NOT NULL,
	"actor_id" text,
	"to_status_id" uuid,
	"status_name" text NOT NULL,
	"status_color" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_mutes" (
	"user_id" text NOT NULL,
	"post_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_mutes_user_id_post_id_pk" PRIMARY KEY("user_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status_id" uuid NOT NULL,
	"category_id" uuid,
	"author_id" text NOT NULL,
	"author_is_admin" boolean DEFAULT false NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by_id" text,
	"merged_into_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', "posts"."title"), 'A') || setweight(to_tsvector('english', coalesce("posts"."description", '')), 'B')) STORED NOT NULL,
	CONSTRAINT "posts_id_product_unique" UNIQUE("id","product_id"),
	CONSTRAINT "posts_no_self_merge" CHECK ("posts"."merged_into_id" IS NULL OR "posts"."merged_into_id" <> "posts"."id")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"post_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "votes_post_id_user_id_pk" PRIMARY KEY("post_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "comment_emails" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "next_post_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_email_batches" ADD CONSTRAINT "comment_email_batches_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_email_batches" ADD CONSTRAINT "comment_email_batches_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_email_items" ADD CONSTRAINT "comment_email_items_batch_id_comment_email_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."comment_email_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_email_items" ADD CONSTRAINT "comment_email_items_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_deleted_by_id_user_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_fk" FOREIGN KEY ("parent_id","post_id") REFERENCES "public"."comments"("id","post_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_activity" ADD CONSTRAINT "post_activity_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_activity" ADD CONSTRAINT "post_activity_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_mutes" ADD CONSTRAINT "post_mutes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_mutes" ADD CONSTRAINT "post_mutes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_deleted_by_id_user_id_fk" FOREIGN KEY ("deleted_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_status_fk" FOREIGN KEY ("status_id","product_id") REFERENCES "public"."statuses"("id","product_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_category_fk" FOREIGN KEY ("category_id","product_id") REFERENCES "public"."categories"("id","product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_merged_into_fk" FOREIGN KEY ("merged_into_id","product_id") REFERENCES "public"."posts"("id","product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_product_name_ci" ON "categories" USING btree ("product_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "comment_email_batches_one_pending" ON "comment_email_batches" USING btree ("user_id","workspace_id") WHERE "comment_email_batches"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "comment_email_batches_due" ON "comment_email_batches" USING btree ("status","send_after");--> statement-breakpoint
CREATE INDEX "comments_post_created" ON "comments" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_author_idx" ON "comments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "post_activity_post_created" ON "post_activity" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "posts_product_number" ON "posts" USING btree ("product_id","number");--> statement-breakpoint
CREATE INDEX "posts_board_top" ON "posts" USING btree ("product_id","vote_count" DESC NULLS LAST,"created_at" DESC NULLS LAST) WHERE "posts"."deleted_at" IS NULL AND "posts"."merged_into_id" IS NULL;--> statement-breakpoint
CREATE INDEX "posts_board_new" ON "posts" USING btree ("product_id","created_at" DESC NULLS LAST) WHERE "posts"."deleted_at" IS NULL AND "posts"."merged_into_id" IS NULL;--> statement-breakpoint
CREATE INDEX "posts_search_gin" ON "posts" USING gin ("search");--> statement-breakpoint
CREATE INDEX "votes_user_idx" ON "votes" USING btree ("user_id");