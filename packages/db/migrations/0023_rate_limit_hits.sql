CREATE TABLE "rate_limit_hits" (
	"key" text PRIMARY KEY NOT NULL,
	"hits" bigint[] NOT NULL,
	"blocked_until" bigint DEFAULT 0 NOT NULL,
	"touched_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL
);
