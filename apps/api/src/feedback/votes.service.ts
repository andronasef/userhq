import { Injectable, Inject } from "@nestjs/common";
import { and, eq, isNull, sql } from "drizzle-orm";
import { DB, type Db, posts, votes } from "@userhq/db";
import { ApiException } from "../common/api-error.filter.js";

@Injectable()
export class VotesService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async setVote(
    productId: string,
    number: number,
    userId: string,
    on: boolean
  ): Promise<{ voted: boolean; voteCount: number }> {
    return this.db.transaction(async (tx) => {
      const [p] = await tx
        .select({ id: posts.id })
        .from(posts)
        .where(
          and(
            eq(posts.productId, productId),
            eq(posts.number, number),
            isNull(posts.deletedAt),
            isNull(posts.mergedIntoId)
          )
        )
        .for("update"); // NOT "share": share-then-update deadlocks two voters

      if (!p) {
        throw new ApiException("post_not_found", 404, "Not found.");
      }

      const changed = on
        ? await tx
            .insert(votes)
            .values({ postId: p.id, userId })
            .onConflictDoNothing()
            .returning({ u: votes.userId })
        : await tx
            .delete(votes)
            .where(and(eq(votes.postId, p.id), eq(votes.userId, userId)))
            .returning({ u: votes.userId });

      const delta = changed.length ? (on ? 1 : -1) : 0;

      const [row] = await tx
        .update(posts)
        .set({
          voteCount: sql`${posts.voteCount} + ${delta}`,
        }) // version NOT bumped
        .where(eq(posts.id, p.id))
        .returning({ voteCount: posts.voteCount });

      return { voted: on, voteCount: row.voteCount };
    });
  }
}
