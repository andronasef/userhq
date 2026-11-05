CREATE TABLE "comment_reads" (
	"user_id" text NOT NULL,
	"comment_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_reads_user_id_comment_id_pk" PRIMARY KEY("user_id","comment_id")
);
--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "handled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "handled_by_id" text;--> statement-breakpoint
ALTER TABLE "comment_reads" ADD CONSTRAINT "comment_reads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_reads" ADD CONSTRAINT "comment_reads_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comment_reads_user_idx" ON "comment_reads" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_handled_by_id_user_id_fk" FOREIGN KEY ("handled_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_handled_idx" ON "comments" USING btree ("handled_at");