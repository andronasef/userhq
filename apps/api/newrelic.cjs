exports.config = {
  app_name: [process.env.NEW_RELIC_APP_NAME || "UserHQ API"],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  agent_enabled:
    Boolean(process.env.NEW_RELIC_LICENSE_KEY) &&
    process.env.NEW_RELIC_ENABLED !== "false",
  distributed_tracing: { enabled: true },
  allow_all_headers: false,
  attributes: { enabled: false, exclude: ["*"] },
  url_obfuscation: {
    enabled: true,
    regex: { pattern: "https?://.*", flags: "g", replacement: "[url]" },
  },
  strip_exception_messages: { enabled: true },
  application_logging: {
    enabled: false,
    forwarding: { enabled: false },
    local_decorating: { enabled: false },
  },
  transaction_tracer: { record_sql: "off" },
  slow_sql: { enabled: false },
  logging: { enabled: false },
  error_collector: {
    ignore_status_codes: [400, 401, 403, 404, 409, 413, 415, 422, 429],
  },
  rules: {
    name: [{ pattern: "^/api/v1/.*", name: "/api/v1/:route" }],
    ignore: ["^/api/auth/", "^/uploads/"],
  },
};
