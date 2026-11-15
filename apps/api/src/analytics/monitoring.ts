import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export function diagnosticEvent(
  name: "UserHQError" | "UserHQDelivery" | "UserHQBacklog",
  attributes: Record<string, string | number | boolean>,
): void {
  if (process.env.NODE_ENV !== "production") return;
  if (
    !process.env.NEW_RELIC_LICENSE_KEY ||
    process.env.NEW_RELIC_ENABLED === "false"
  )
    return;
  try {
    require("newrelic").recordCustomEvent(name, attributes);
  } catch {
    /* diagnostics are optional */
  }
}
export function reportApiError(status: number): void {
  if (process.env.NODE_ENV !== "production") return;
  if (
    status < 500 ||
    !process.env.NEW_RELIC_LICENSE_KEY ||
    process.env.NEW_RELIC_ENABLED === "false"
  )
    return;
  try {
    require("newrelic").noticeError(new Error("UserHQ internal_error"), {
      error_code: "internal_error",
    });
  } catch {
    /* diagnostics are optional */
  }
}
