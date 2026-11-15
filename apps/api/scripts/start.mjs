import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const enabled =
  process.env.NODE_ENV === "production" &&
  Boolean(process.env.NEW_RELIC_LICENSE_KEY) &&
  process.env.NEW_RELIC_ENABLED !== "false";
const args = enabled
  ? [
      "--import",
      require.resolve("newrelic/esm-loader.mjs"),
      "--require",
      require.resolve("newrelic"),
    ]
  : [];
const child = spawn(
  process.execPath,
  [...args, new URL("../dist/main.js", import.meta.url).pathname],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEW_RELIC_HOME: new URL("../", import.meta.url).pathname,
    },
  },
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
