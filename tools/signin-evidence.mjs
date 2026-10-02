#!/usr/bin/env node
import { execSync } from "node:child_process";
import process from "node:process";

function printUsageAndExit(message) {
  if (message) {
    console.error(`Error: ${message}`);
  }
  console.error(
    "Usage: node tools/signin-evidence.mjs --project <project> --user <userId> --since <ISO-8601 UTC> [--host <host>] [--base-url <url>] [--expect-upload]"
  );
  process.exit(2);
}

// Parse CLI flags
const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith("--")) {
    const key = arg.slice(2);
    if (key === "expect-upload") {
      flags["expect-upload"] = true;
    } else {
      const val = args[++i];
      if (!val || val.startsWith("--")) {
        printUsageAndExit(`Missing value for flag --${key}`);
      }
      flags[key] = val;
    }
  }
}

const { project, user: userId, since, host = "userhq-vps", "base-url": baseUrl } = flags;
const expectUpload = Boolean(flags["expect-upload"]);

if (!project) printUsageAndExit("Missing required --project flag");
if (!userId) printUsageAndExit("Missing required --user flag");
if (!since) printUsageAndExit("Missing required --since flag");

// Validation patterns
const PROJECT_RE = /^[a-z0-9][a-z0-9_-]*$/;
const USER_RE = /^[A-Za-z0-9_-]{1,128}$/;

if (!PROJECT_RE.test(project)) {
  printUsageAndExit(`Invalid --project "${project}": must match ^[a-z0-9][a-z0-9_-]*$`);
}

if (!USER_RE.test(userId)) {
  printUsageAndExit(`Invalid --user "${userId}": must match ^[A-Za-z0-9_-]{1,128}$`);
}

const sinceDate = new Date(since);
if (isNaN(sinceDate.getTime())) {
  printUsageAndExit(`Invalid --since "${since}": must be a valid ISO-8601 date string`);
}
const sinceIso = sinceDate.toISOString();

if (baseUrl && !baseUrl.startsWith("https://")) {
  printUsageAndExit(`Invalid --base-url "${baseUrl}": must start with https://`);
}

function runRemoteCommand(cmd) {
  try {
    if (host === "local" || host === "localhost" || !host) {
      return execSync(cmd, { encoding: "utf-8" }).trim();
    }
    const escaped = cmd.replace(/'/g, "'\\''");
    return execSync(`ssh -o BatchMode=yes ${host} '${escaped}'`, {
      encoding: "utf-8",
    }).trim();
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    console.error(`Remote execution failed: ${stderr}`);
    process.exit(2);
  }
}

// 1. Locate postgres container
const findContainerCmd = `docker ps -q --filter label=com.docker.compose.project=${project} --filter label=com.docker.compose.service=postgres`;
const containerId = runRemoteCommand(findContainerCmd);

if (!containerId || containerId.includes("\n")) {
  console.error(
    `Expected exactly one postgres container for project "${project}", found: "${containerId || "none"}"`
  );
  process.exit(2);
}

// 2. Query DB via psql inside the container
// Never select email, name, or tokens.
const sql = `
SELECT json_build_object(
  'user_exists', (SELECT count(*) > 0 FROM "user" WHERE id = '${userId}'),
  'user_image', (SELECT image FROM "user" WHERE id = '${userId}'),
  'accounts', (
    SELECT json_agg(json_build_object(
      'provider_id', provider_id,
      'created_at', created_at,
      'updated_at', updated_at
    ) ORDER BY created_at ASC)
    FROM account
    WHERE user_id = '${userId}'
  ),
  'live_sessions_since', (
    SELECT count(*)
    FROM session
    WHERE user_id = '${userId}' AND created_at >= '${sinceIso}'
  ),
  'uploads', (
    SELECT json_agg(json_build_object(
      'storage_key', storage_key,
      'created_at', created_at
    ) ORDER BY created_at DESC)
    FROM uploads
    WHERE uploader_id = '${userId}' AND created_at >= '${sinceIso}'
  )
);
`;

const psqlCmd = `docker exec -i ${containerId} sh -c 'psql -X -v ON_ERROR_STOP=1 -tA -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'EOF'
${sql}
EOF`;

let dbJsonRaw;
try {
  dbJsonRaw = runRemoteCommand(psqlCmd);
} catch (err) {
  console.error(`Failed to execute psql query inside container ${containerId}: ${err.message}`);
  process.exit(2);
}

let dbData;
try {
  dbData = JSON.parse(dbJsonRaw);
} catch {
  console.error(`Failed to parse psql JSON response: ${dbJsonRaw}`);
  process.exit(2);
}

const reasons = [];

if (!dbData.user_exists) {
  reasons.push("user not found");
}

const accounts = dbData.accounts || [];
const providers = accounts.map((a) => a.provider_id);
const hasGoogle = providers.includes("google");
const hasGithub = providers.includes("github");

if (!hasGoogle) reasons.push("missing provider: google");
if (!hasGithub) reasons.push("missing provider: github");

// Check freshness: greatest(created_at, updated_at) >= since
const freshProviders = [];
for (const acc of accounts) {
  const created = new Date(acc.created_at).getTime();
  const updated = new Date(acc.updated_at).getTime();
  const latest = Math.max(created, updated);
  if (latest >= sinceDate.getTime()) {
    freshProviders.push(acc.provider_id);
  }
}

if (hasGoogle && !freshProviders.includes("google")) {
  reasons.push("google account was not used since gate start");
}
if (hasGithub && !freshProviders.includes("github")) {
  reasons.push("github account was not used since gate start");
}

// First provider and avatar host
let firstProvider = null;
let imageHost = null;

if (accounts.length > 0) {
  firstProvider = accounts[0].provider_id;
}

if (dbData.user_image) {
  try {
    const url = new URL(dbData.user_image);
    imageHost = url.hostname;
  } catch {
    imageHost = null;
  }
}

if (firstProvider === "google") {
  if (imageHost !== "lh3.googleusercontent.com") {
    reasons.push(`avatar host mismatch: expected lh3.googleusercontent.com, got ${imageHost}`);
  }
} else if (firstProvider === "github") {
  if (imageHost !== "avatars.githubusercontent.com") {
    reasons.push(`avatar host mismatch: expected avatars.githubusercontent.com, got ${imageHost}`);
  }
}

// Session count check: sessions created since gate start must be 0 after sign-out
const liveSessionsSince = dbData.live_sessions_since || 0;
if (liveSessionsSince > 0) {
  reasons.push(`${liveSessionsSince} session(s) still active after sign-out`);
}

// Uploads check if --expect-upload is set
let uploadStorageKey = null;
if (expectUpload) {
  const uploads = dbData.uploads || [];
  if (uploads.length === 0) {
    reasons.push("missing upload created since gate start");
  } else {
    uploadStorageKey = uploads[0].storage_key;
    if (baseUrl) {
      const uploadUrl = `${baseUrl.replace(/\/+$/, "")}/uploads/${uploadStorageKey}`;
      try {
        const res = execSync(`curl -s -o /dev/null -w "%{http_code}:%{content_type}" "${uploadUrl}"`, {
          encoding: "utf-8",
        }).trim();
        const [status, contentType] = res.split(":");
        if (status !== "200") {
          reasons.push(`upload url returned HTTP ${status}: ${uploadUrl}`);
        }
        if (!contentType || !contentType.includes("image/webp")) {
          reasons.push(`upload content-type is not image/webp: ${contentType}`);
        }
      } catch (err) {
        reasons.push(`failed to verify upload url ${uploadUrl}: ${err.message}`);
      }
    }
  }
}

const summaryResult = {
  project,
  user: userId,
  providers,
  firstProvider,
  imageHost,
  freshProviders,
  liveSessionsSince,
  upload: uploadStorageKey,
};

console.log(JSON.stringify(summaryResult));

if (reasons.length === 0) {
  console.log(`signin-evidence-ok ${project}`);
  process.exit(0);
} else {
  console.log(`signin-evidence-fail ${project}: ${reasons.join(", ")}`);
  process.exit(1);
}
