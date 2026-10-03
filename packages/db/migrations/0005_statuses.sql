CREATE TYPE "public"."status_type" AS ENUM('review', 'planned', 'active', 'completed', 'closed');--> statement-breakpoint
CREATE TABLE "statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"type" "status_type" NOT NULL,
	"position" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "statuses_id_product_unique" UNIQUE("id","product_id"),
	CONSTRAINT "statuses_color_hex" CHECK ("statuses"."color" ~ '^#[0-9A-F]{6}$')
);
--> statement-breakpoint
ALTER TABLE "statuses" ADD CONSTRAINT "statuses_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "statuses_product_name_ci" ON "statuses" USING btree ("product_id",lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "statuses_one_default" ON "statuses" USING btree ("product_id") WHERE "statuses"."is_default";--> statement-breakpoint
CREATE INDEX "statuses_product_position_idx" ON "statuses" USING btree ("product_id","position");