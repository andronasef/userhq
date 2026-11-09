ALTER TABLE "changelog_entries" ADD COLUMN "source_locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "changelog_entries" ADD COLUMN "translations" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "faq_questions" ADD COLUMN "source_locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "faq_questions" ADD COLUMN "translations" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "roadmap_items" ADD COLUMN "source_locale" text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE "roadmap_items" ADD COLUMN "translations" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "locales" jsonb DEFAULT '{"defaultLocale":"en","enabledLocales":["en"]}'::jsonb NOT NULL;