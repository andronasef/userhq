-- An empty list already behaved as "unrestricted" (tenant.guard.ts, outbox.ts), so this only makes the stored value say what it did.
UPDATE "workspace_api_keys"
SET "product_restrictions" = NULL
WHERE "product_restrictions" = '[]'::jsonb;
--> statement-breakpoint
UPDATE "webhook_subscriptions"
SET "product_restrictions" = NULL
WHERE "product_restrictions" = '[]'::jsonb;
