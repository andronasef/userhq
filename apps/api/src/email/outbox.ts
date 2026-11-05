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

  // Share-lock the product row until the caller's transaction ends: a concurrent Board disable
  // (UPDATE products) waits for this enqueue, so its cleanup always sees the item (D-14).
  const enabled = await tx.execute(sql`
    SELECT 1 FROM posts p JOIN products pr ON pr.id = p.product_id
    WHERE p.id = ${postId} AND pr.workspace_id = ${workspaceId} AND pr.board_enabled
    FOR SHARE OF pr
  `);
  if ((enabled.rows ?? enabled).length === 0) return;

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
