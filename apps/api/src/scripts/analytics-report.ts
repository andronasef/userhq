import pg from "pg";
import { diagnosticEvent } from "../analytics/monitoring.js";

/** Operator CLI only: current-state truth cannot be reconstructed from GA funnels. */
async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
  });
  const client = await pool.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '15s'");
    const result = await client.query(`
      WITH external_posts AS (
        SELECT p.id, p.product_id, p.created_at, pr.workspace_id
        FROM posts p JOIN products pr ON pr.id=p.product_id JOIN workspaces w ON w.id=pr.workspace_id
        WHERE p.deleted_at IS NULL AND p.merged_into_id IS NULL AND pr.deleted_at IS NULL AND w.deleted_at IS NULL
          AND p.created_by_api_key_id IS NULL
          AND NOT EXISTS (SELECT 1 FROM workspace_members m WHERE m.workspace_id=pr.workspace_id AND m.user_id=p.author_id)
      ), responses AS (
        SELECT p.id, p.workspace_id, p.created_at,
          LEAST(
            (SELECT min(c.created_at) FROM comments c WHERE c.post_id=p.id AND c.is_admin AND c.deleted_at IS NULL AND c.created_by_api_key_id IS NULL),
            (SELECT min(a.created_at) FROM post_activity a WHERE a.post_id=p.id AND a.kind='status_changed' AND a.api_key_id IS NULL)
          ) AS response_at
        FROM external_posts p
      )
      SELECT count(*)::int AS external_requests,
        count(*) FILTER (WHERE response_at IS NULL)::int AS unanswered_requests,
        count(*) FILTER (WHERE response_at IS NOT NULL)::int AS acknowledged_requests,
        coalesce(max(extract(epoch FROM (now()-created_at))/3600) FILTER (WHERE response_at IS NULL),0)::float AS oldest_unanswered_hours,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (response_at-created_at))/3600) FILTER (WHERE response_at IS NOT NULL) AS median_response_hours,
        percentile_cont(0.9) WITHIN GROUP (ORDER BY extract(epoch FROM (response_at-created_at))/3600) FILTER (WHERE response_at IS NOT NULL) AS p90_response_hours,
        count(DISTINCT workspace_id) FILTER (WHERE response_at IS NOT NULL)::int AS workspaces_with_response
      FROM responses`);
    const stages = await client.query(`
      SELECT count(DISTINCT w.id)::int AS workspaces,
        count(DISTINCT w.id) FILTER (WHERE pr.id IS NOT NULL)::int AS workspaces_with_product,
        count(DISTINCT w.id) FILTER (WHERE pr.board_enabled OR pr.roadmap_enabled OR pr.changelog_enabled OR pr.faq_enabled)::int AS workspaces_with_ready_portal
      FROM workspaces w LEFT JOIN products pr ON pr.workspace_id=w.id AND pr.deleted_at IS NULL WHERE w.deleted_at IS NULL`);
    const activation = await client.query(`
      WITH eligible AS (
        SELECT p.id, p.author_id, p.created_at, p.created_by_api_key_id, pr.workspace_id
        FROM posts p JOIN products pr ON pr.id=p.product_id JOIN workspaces w ON w.id=pr.workspace_id
        WHERE p.deleted_at IS NULL AND p.merged_into_id IS NULL AND pr.deleted_at IS NULL AND w.deleted_at IS NULL
      ), contribution AS (
        SELECT p.id AS post_id, p.workspace_id, p.created_at, p.author_id AS user_id FROM eligible p WHERE p.created_by_api_key_id IS NULL
        UNION ALL
        SELECT p.id, p.workspace_id, v.created_at, v.user_id FROM eligible p JOIN votes v ON v.post_id=p.id
        UNION ALL
        SELECT p.id, p.workspace_id, c.created_at, c.author_id FROM eligible p JOIN comments c ON c.post_id=p.id
          WHERE c.deleted_at IS NULL AND NOT c.is_admin AND c.created_by_api_key_id IS NULL
      ), outside AS (
        SELECT c.* FROM contribution c WHERE c.user_id NOT LIKE 'integration:%'
          AND NOT EXISTS (SELECT 1 FROM workspace_members m WHERE m.workspace_id=c.workspace_id AND m.user_id=c.user_id)
      ), first_input AS (
        SELECT workspace_id, min(created_at) AS contributed_at FROM outside GROUP BY workspace_id
      ), activation AS (
        SELECT f.workspace_id, f.contributed_at, min(r.responded_at) AS responded_at
        FROM first_input f LEFT JOIN LATERAL (
          SELECT c.created_at AS responded_at FROM comments c JOIN eligible p ON p.id=c.post_id
            WHERE p.workspace_id=f.workspace_id AND c.is_admin AND c.deleted_at IS NULL AND c.created_by_api_key_id IS NULL
              AND c.author_id NOT LIKE 'integration:%' AND c.created_at>=f.contributed_at
              AND EXISTS (SELECT 1 FROM outside o WHERE o.post_id=p.id AND o.created_at<=c.created_at)
          UNION ALL
          SELECT a.created_at FROM post_activity a JOIN eligible p ON p.id=a.post_id
            WHERE p.workspace_id=f.workspace_id AND a.api_key_id IS NULL AND a.actor_id NOT LIKE 'integration:%'
              AND a.created_at>=f.contributed_at AND EXISTS (SELECT 1 FROM outside o WHERE o.post_id=p.id AND o.created_at<=a.created_at)
        ) r ON true GROUP BY f.workspace_id, f.contributed_at
      )
      SELECT count(*)::int AS workspaces_with_external_contribution,
        count(*) FILTER (WHERE responded_at IS NOT NULL)::int AS activated_workspaces,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM (responded_at-contributed_at))/3600) FILTER (WHERE responded_at IS NOT NULL) AS median_contribution_to_response_hours
      FROM activation`);
    await client.query("COMMIT");
    const report = {
      generated_at: new Date().toISOString(),
      ...stages.rows[0],
      ...result.rows[0],
      ...activation.rows[0],
    };
    console.log(JSON.stringify(report, null, 2));
    if (process.argv.includes("--publish")) {
      const metrics = Object.fromEntries(
        Object.entries(report).filter(([, v]) => typeof v === "number"),
      ) as Record<string, number>;
      diagnosticEvent("UserHQBacklog", metrics);
    }
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(() => {
  console.error(
    "analytics-report: database report failed; check database configuration/schema.",
  );
  process.exitCode = 1;
});
