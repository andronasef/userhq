CREATE TABLE "changelog_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"summary" text,
	"content" jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "changelog_entries_id_product_unique" UNIQUE("id","product_id"),
	CONSTRAINT "changelog_entries_product_slug_unique" UNIQUE("product_id","slug")
);
--> statement-breakpoint
CREATE TABLE "changelog_entry_tags" (
	"entry_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "changelog_entry_tags_entry_id_tag_id_pk" PRIMARY KEY("entry_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "changelog_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "changelog_tags_id_product_unique" UNIQUE("id","product_id")
);
--> statement-breakpoint
CREATE TABLE "faq_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"rank" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faq_categories_id_product_unique" UNIQUE("id","product_id")
);
--> statement-breakpoint
CREATE TABLE "faq_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" jsonb NOT NULL,
	"rank" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faq_questions_id_product_unique" UNIQUE("id","product_id")
);
--> statement-breakpoint
ALTER TABLE "changelog_entries" ADD CONSTRAINT "changelog_entries_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changelog_entry_tags" ADD CONSTRAINT "changelog_entry_tags_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changelog_entry_tags" ADD CONSTRAINT "changelog_entry_tags_entry_fk" FOREIGN KEY ("entry_id","product_id") REFERENCES "public"."changelog_entries"("id","product_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changelog_entry_tags" ADD CONSTRAINT "changelog_entry_tags_tag_fk" FOREIGN KEY ("tag_id","product_id") REFERENCES "public"."changelog_tags"("id","product_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changelog_tags" ADD CONSTRAINT "changelog_tags_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq_categories" ADD CONSTRAINT "faq_categories_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq_questions" ADD CONSTRAINT "faq_questions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq_questions" ADD CONSTRAINT "faq_questions_category_fk" FOREIGN KEY ("category_id","product_id") REFERENCES "public"."faq_categories"("id","product_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "changelog_entries_product_published_idx" ON "changelog_entries" USING btree ("product_id","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "changelog_tags_product_name_ci" ON "changelog_tags" USING btree ("product_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "faq_categories_product_name_ci" ON "faq_categories" USING btree ("product_id",lower("name"));--> statement-breakpoint
CREATE INDEX "faq_categories_product_rank_idx" ON "faq_categories" USING btree ("product_id","rank");--> statement-breakpoint
CREATE INDEX "faq_questions_product_category_rank_idx" ON "faq_questions" USING btree ("product_id","category_id","rank");