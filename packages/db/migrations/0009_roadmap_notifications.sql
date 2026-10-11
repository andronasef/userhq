CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"post_id" uuid NOT NULL,
	"post_activity_id" uuid NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_user_post_unique" UNIQUE("user_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "user_product_activity_visits" (
	"user_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"last_visited_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_product_activity_visits_user_product_pk" PRIMARY KEY("user_id","product_id"),
	CONSTRAINT "user_product_activity_visits_user_product_unique" UNIQUE("user_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "roadmap_item_internals" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"internal_title" text NOT NULL,
	"internal_description" text,
	"internal_notes" text,
	"assignee_id" text,
	"deadline_text" text,
	"deadline_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roadmap_item_internals_item_product_unique" UNIQUE("item_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "roadmap_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"status_id" uuid NOT NULL,
	"public_title" text,
	"public_description" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"rank" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roadmap_items_id_product_unique" UNIQUE("id","product_id")
);
--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "roadmap_item_id" uuid;--> statement-breakpoint
ALTER TABLE "statuses" ADD COLUMN "is_public_roadmap" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_post_activity_id_post_activity_id_fk" FOREIGN KEY ("post_activity_id") REFERENCES "public"."post_activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_product_activity_visits" ADD CONSTRAINT "user_product_activity_visits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_product_activity_visits" ADD CONSTRAINT "user_product_activity_visits_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_item_internals" ADD CONSTRAINT "roadmap_item_internals_item_id_roadmap_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."roadmap_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_item_internals" ADD CONSTRAINT "roadmap_item_internals_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_item_internals" ADD CONSTRAINT "roadmap_item_internals_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roadmap_items" ADD CONSTRAINT "roadmap_items_status_fk" FOREIGN KEY ("status_id","product_id") REFERENCES "public"."statuses"("id","product_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_user_read_created_idx" ON "notifications" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "roadmap_item_internals_product_assignee_idx" ON "roadmap_item_internals" USING btree ("product_id","assignee_id");--> statement-breakpoint
CREATE INDEX "roadmap_items_product_status_rank_idx" ON "roadmap_items" USING btree ("product_id","status_id","rank");--> statement-breakpoint
CREATE INDEX "roadmap_items_product_public_idx" ON "roadmap_items" USING btree ("product_id","is_public");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_roadmap_item_id_roadmap_items_id_fk" FOREIGN KEY ("roadmap_item_id") REFERENCES "public"."roadmap_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "posts_product_roadmap_item_idx" ON "posts" USING btree ("product_id","roadmap_item_id");