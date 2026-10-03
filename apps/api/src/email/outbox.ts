import { sql } from "drizzle-orm";
import type { Db } from "@userhq/db";

export interface EnqueueCommentEmailParams {
  postId: string;
  commentId: string;
  actorId: string;
  workspaceId: string;
}

export async function enqueueCommentEmail(
  tx: Db | any,
  params: EnqueueCommentEmailParams
): Promise<void> {
  const { postId, commentId, actorId, workspaceId } = params;

  await tx.execute(sql`
    WITH r AS (
      SELECT DISTINCT u.id FROM (
        SELECT author_id AS uid FROM posts WHERE id = ${postId}
        UNION SELECT author_id FROM comments WHERE post_id = ${postId} AND deleted_at IS NULL
      ) c JOIN "user" u ON u.id = c.uid
      WHERE u.id <> ${actorId} AND u.comment_emails AND u.deleted_at IS NULL AND u.banned_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM post_mutes m WHERE m.user_id = u.id AND m.post_id = ${postId})
    ), b AS (
      INSERT INTO comment_email_batches (user_id, workspace_id, send_after)
      SELECT id, ${workspaceId}, now() + interval '24 hours' FROM r
      ON CONFLICT (user_id, workspace_id) WHERE status = 'pending'
      DO UPDATE SET user_id = EXCLUDED.user_id
      RETURNING id
    )
    INSERT INTO comment_email_items (batch_id, comment_id)
    SELECT id, ${commentId} FROM b
    ON CONFLICT (batch_id, comment_id) DO NOTHING;
  `);
}
