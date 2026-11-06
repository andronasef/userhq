-- Backfill team-shared handled state (D-04): a customer comment is handled once a later,
-- non-deleted admin comment exists in its thread (same post, same thread root).
-- Idempotent: only touches unhandled, non-deleted customer comments, so existing handlers
-- are preserved and a second run changes nothing. No DDL, no deletes.
WITH resolved AS (
	SELECT DISTINCT ON (c."id")
		c."id",
		a."created_at" AS "handled_at",
		a."author_id" AS "handled_by_id"
	FROM "comments" c
	JOIN "comments" a
		ON a."post_id" = c."post_id"
		AND a."is_admin" = true
		AND a."deleted_at" IS NULL
		AND coalesce(a."parent_id", a."id") = coalesce(c."parent_id", c."id")
		AND a."created_at" > c."created_at"
	WHERE c."is_admin" = false
		AND c."handled_at" IS NULL
		AND c."deleted_at" IS NULL
	ORDER BY c."id", a."created_at", a."id"
)
UPDATE "comments"
SET "handled_at" = resolved."handled_at",
	"handled_by_id" = resolved."handled_by_id"
FROM resolved
WHERE "comments"."id" = resolved."id";
