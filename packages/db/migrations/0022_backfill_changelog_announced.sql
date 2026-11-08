-- Existing live entries were announced inline or predate scheduled announcements. Never replay them.
UPDATE "changelog_entries"
SET "announced_at" = "published_at"
WHERE "published_at" IS NOT NULL
  AND "published_at" <= now()
  AND "announced_at" IS NULL;
