CREATE TABLE "product_badge_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"badge_id" uuid NOT NULL,
	"param_key" text NOT NULL,
	"match_type" text DEFAULT 'exact' NOT NULL,
	"match_value" text NOT NULL,
	"secret_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#0284c7' NOT NULL,
	"text_color" text DEFAULT '#ffffff' NOT NULL,
	"icon" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_product_badges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"badge_id" uuid NOT NULL,
	"source" text DEFAULT 'rule' NOT NULL,
	"matched_param_value" text,
	"expires_at" timestamp with time zone,
	"granted_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_badge_rules" ADD CONSTRAINT "product_badge_rules_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_badge_rules" ADD CONSTRAINT "product_badge_rules_badge_id_product_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."product_badges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_badges" ADD CONSTRAINT "product_badges_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_product_badges" ADD CONSTRAINT "user_product_badges_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_product_badges" ADD CONSTRAINT "user_product_badges_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_product_badges" ADD CONSTRAINT "user_product_badges_badge_id_product_badges_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."product_badges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_product_badges" ADD CONSTRAINT "user_product_badges_granted_by_user_id_user_id_fk" FOREIGN KEY ("granted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_badge_rules_product_id_idx" ON "product_badge_rules" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_badge_rules_badge_id_idx" ON "product_badge_rules" USING btree ("badge_id");--> statement-breakpoint
CREATE INDEX "product_badge_rules_param_key_idx" ON "product_badge_rules" USING btree ("product_id","param_key");--> statement-breakpoint
CREATE UNIQUE INDEX "product_badges_product_slug_idx" ON "product_badges" USING btree ("product_id","slug");--> statement-breakpoint
CREATE INDEX "product_badges_product_id_idx" ON "product_badges" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_badges_priority_idx" ON "product_badges" USING btree ("product_id","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "user_product_badges_user_product_badge_idx" ON "user_product_badges" USING btree ("user_id","product_id","badge_id");--> statement-breakpoint
CREATE INDEX "user_product_badges_product_user_idx" ON "user_product_badges" USING btree ("product_id","user_id");--> statement-breakpoint
CREATE INDEX "user_product_badges_badge_id_idx" ON "user_product_badges" USING btree ("badge_id");