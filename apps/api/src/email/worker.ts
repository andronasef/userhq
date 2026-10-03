import {
  Injectable,
  Inject,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { and, eq, isNull, sql, notExists, asc } from "drizzle-orm";
import {
  DB,
  type Db,
  commentEmailBatches,
  commentEmailItems,
  comments,
  posts,
  products,
  workspaces,
  postMutes,
  user,
} from "@userhq/db";
import { postSlug } from "@userhq/types";
import { ENV, type Env } from "../env.js";
import { createSmtpTransport } from "./transport.js";
import { signToken } from "./tokens.js";
import { renderCommentEmail, type EmailPostSection } from "./render.js";

const BACKOFF_MINUTES = [5, 30, 120, 360]; // 5m, 30m, 2h, 6h

@Injectable()
export class EmailWorker
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(EmailWorker.name);
  private intervalRef?: NodeJS.Timeout;
  readonly enabled: boolean;

  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(ENV) private readonly env: Env
  ) {
    this.enabled = Boolean(this.env.SMTP_HOST);
  }

  onApplicationBootstrap(): void {
    if (this.enabled && this.env.NODE_ENV !== "test") {
      this.intervalRef = setInterval(() => {
        void this.runOnce(new Date());
      }, 60_000);
      this.intervalRef.unref?.();
      this.logger.log("Email worker started with 60s interval");
    }
  }

  onApplicationShutdown(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = undefined;
    }
  }

  async runOnce(now: Date = new Date()): Promise<{
    claimed: number;
    sent: number;
    failed: number;
    cancelled: number;
  }> {
    let sentCount = 0;
    let failedCount = 0;
    let cancelledCount = 0;

    const reclaimThreshold = new Date(now.getTime() - 10 * 60_000);

    // Claim due batches with FOR UPDATE SKIP LOCKED
    const claimedBatches = await this.db.transaction(async (tx) => {
      const res = await tx.execute<{
        id: string;
        user_id: string;
        workspace_id: string;
        attempts: number;
      }>(sql`
        UPDATE comment_email_batches SET status = 'sending', claimed_at = now()
        WHERE id IN (
          SELECT id FROM comment_email_batches
          WHERE (status IN ('pending', 'retrying') AND send_after <= ${now})
             OR (status = 'sending' AND claimed_at < ${reclaimThreshold})
          ORDER BY send_after LIMIT 20 FOR UPDATE SKIP LOCKED
        )
        RETURNING id, user_id, workspace_id, attempts;
      `);
      return ((res as any).rows ?? res) as Array<{
        id: string;
        user_id: string;
        workspace_id: string;
        attempts: number;
      }>;
    });

    for (const batch of claimedBatches) {
      // 1. Re-check recipient status at send time
      const [recipient] = await this.db
        .select({
          id: user.id,
          email: user.email,
          commentEmails: user.commentEmails,
          deletedAt: user.deletedAt,
          bannedAt: user.bannedAt,
        })
        .from(user)
        .where(eq(user.id, batch.user_id))
        .limit(1);

      if (
        !recipient ||
        !recipient.commentEmails ||
        recipient.deletedAt !== null ||
        recipient.bannedAt !== null
      ) {
        await this.db
          .update(commentEmailBatches)
          .set({ status: "cancelled" })
          .where(eq(commentEmailBatches.id, batch.id));
        cancelledCount++;
        continue;
      }

      // 2. Re-check workspace status at send time
      const [ws] = await this.db
        .select({
          id: workspaces.id,
          name: workspaces.name,
          slug: workspaces.slug,
          deletedAt: workspaces.deletedAt,
          suspendedAt: workspaces.suspendedAt,
        })
        .from(workspaces)
        .where(eq(workspaces.id, batch.workspace_id))
        .limit(1);

      if (!ws || ws.deletedAt !== null || ws.suspendedAt !== null) {
        await this.db
          .update(commentEmailBatches)
          .set({ status: "cancelled" })
          .where(eq(commentEmailBatches.id, batch.id));
        cancelledCount++;
        continue;
      }

      // 3. Load items joined to non-deleted comments, following current post (not deleted, not merged),
      // and checking post is not muted by recipient
      const items = await this.db
        .select({
          commentId: comments.id,
          commentBody: comments.body,
          commentCreatedAt: comments.createdAt,
          commentIsAdmin: comments.isAdmin,
          authorId: comments.authorId,
          authorName: user.name,
          authorDeletedAt: user.deletedAt,
          postId: posts.id,
          postNumber: posts.number,
          postTitle: posts.title,
          productName: products.name,
          productSlug: products.slug,
        })
        .from(commentEmailItems)
        .innerJoin(comments, eq(commentEmailItems.commentId, comments.id))
        .innerJoin(posts, eq(comments.postId, posts.id))
        .innerJoin(products, eq(posts.productId, products.id))
        .leftJoin(user, eq(comments.authorId, user.id))
        .where(
          and(
            eq(commentEmailItems.batchId, batch.id),
            isNull(comments.deletedAt),
            isNull(posts.deletedAt),
            isNull(posts.mergedIntoId),
            isNull(products.deletedAt),
            eq(products.workspaceId, ws.id),
            notExists(
              this.db
                .select()
                .from(postMutes)
                .where(
                  and(
                    eq(postMutes.userId, recipient.id),
                    eq(postMutes.postId, posts.id)
                  )
                )
            )
          )
        )
        .orderBy(asc(comments.createdAt), asc(comments.id));

      if (items.length === 0) {
        await this.db
          .update(commentEmailBatches)
          .set({ status: "cancelled" })
          .where(eq(commentEmailBatches.id, batch.id));
        cancelledCount++;
        continue;
      }

      // 4. Group items by post
      const postsMap = new Map<
        string,
        {
          postId: string;
          postNumber: number;
          postTitle: string;
          productName: string;
          productSlug: string;
          newestCreatedAt: Date;
          comments: typeof items;
        }
      >();

      for (const item of items) {
        let group = postsMap.get(item.postId);
        if (!group) {
          group = {
            postId: item.postId,
            postNumber: item.postNumber,
            postTitle: item.postTitle,
            productName: item.productName,
            productSlug: item.productSlug,
            newestCreatedAt: item.commentCreatedAt,
            comments: [],
          };
          postsMap.set(item.postId, group);
        }
        group.comments.push(item);
        if (item.commentCreatedAt > group.newestCreatedAt) {
          group.newestCreatedAt = item.commentCreatedAt;
        }
      }

      // Sort sections by newest comment descending
      const sortedGroups = Array.from(postsMap.values()).sort(
        (a, b) => b.newestCreatedAt.getTime() - a.newestCreatedAt.getTime()
      );

      const allToken = signToken(
        this.env.BETTER_AUTH_SECRET,
        recipient.id,
        "all"
      );
      const unsubscribeUrl = `${this.env.PUBLIC_URL}/unsubscribe/${allToken}`;

      const sections: EmailPostSection[] = sortedGroups.map((g) => {
        const postSlugPart = postSlug(g.postTitle);
        const postUrl = `${this.env.PUBLIC_URL}/${ws.slug}/${g.productSlug}/p/${g.postNumber}-${postSlugPart}`;
        const muteToken = signToken(
          this.env.BETTER_AUTH_SECRET,
          recipient.id,
          `p:${g.postId}`
        );
        const muteUrl = `${this.env.PUBLIC_URL}/unsubscribe/${muteToken}`;

        // Take up to latest 3 comments, ordered oldest to newest
        const last3Comments = g.comments.slice(-3);
        const moreCount = Math.max(0, g.comments.length - 3);

        return {
          productName: g.productName,
          postTitle: g.postTitle,
          postUrl,
          muteUrl,
          moreCount,
          comments: last3Comments.map((c) => ({
            authorName:
              c.authorDeletedAt !== null
                ? "Deleted user"
                : (c.authorName ?? "Anonymous"),
            isAdmin: c.commentIsAdmin,
            body: c.commentBody,
          })),
        };
      });

      const { subject, text, html } = renderCommentEmail({
        workspaceName: ws.name,
        sections,
        unsubscribeUrl,
      });

      const transport = createSmtpTransport({
        host: this.env.SMTP_HOST!,
        port: this.env.SMTP_PORT ?? 587,
        user: this.env.SMTP_USER,
        pass: this.env.SMTP_PASS,
        requireTls: this.env.SMTP_REQUIRE_TLS ?? true,
      });

      try {
        await transport.sendMail({
          from: {
            name: `${ws.name} via UserHQ`,
            address: this.env.SMTP_FROM!,
          },
          to: recipient.email,
          subject,
          text,
          html,
          headers: {
            "List-Unsubscribe": `<${this.env.PUBLIC_URL}/api/v1/unsubscribe/${allToken}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });

        // ponytail: at-least-once — a crash after SMTP accepts but before the row is marked sent resends once
        await this.db
          .update(commentEmailBatches)
          .set({
            status: "sent",
            sentAt: new Date(),
          })
          .where(eq(commentEmailBatches.id, batch.id));

        sentCount++;
      } catch (err: unknown) {
        const errorMsg = String((err as any)?.message ?? err);
        let redacted = errorMsg;
        if (this.env.SMTP_PASS) {
          redacted = redacted.replaceAll(this.env.SMTP_PASS, "[REDACTED]");
        }
        if (this.env.SMTP_USER) {
          redacted = redacted.replaceAll(this.env.SMTP_USER, "[REDACTED]");
        }

        const nextAttempts = batch.attempts + 1;
        if (nextAttempts >= 5) {
          await this.db
            .update(commentEmailBatches)
            .set({
              status: "failed",
              attempts: nextAttempts,
              lastError: redacted,
            })
            .where(eq(commentEmailBatches.id, batch.id));
          failedCount++;
          this.logger.warn(
            `Email batch ${batch.id} failed after 5 attempts: ${redacted}`
          );
        } else {
          const backoffMin = BACKOFF_MINUTES[nextAttempts - 1] ?? 360;
          const nextSendAfter = new Date(now.getTime() + backoffMin * 60_000);
          await this.db
            .update(commentEmailBatches)
            .set({
              status: "retrying",
              attempts: nextAttempts,
              sendAfter: nextSendAfter,
              lastError: redacted,
            })
            .where(eq(commentEmailBatches.id, batch.id));
          failedCount++;
        }
      } finally {
        transport.close();
      }
    }

    return {
      claimed: claimedBatches.length,
      sent: sentCount,
      failed: failedCount,
      cancelled: cancelledCount,
    };
  }
}
