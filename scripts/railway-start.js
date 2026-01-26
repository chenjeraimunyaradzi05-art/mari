const { spawnSync } = require("node:child_process");
const path = require("node:path");

const serviceName = (process.env.RAILWAY_SERVICE_NAME || "").toLowerCase();

const isWeb = serviceName.includes("web") || serviceName.includes("client") || serviceName.includes("frontend");
const isApi = serviceName.includes("api") || serviceName.includes("server") || serviceName.includes("backend");

const target = isWeb ? "athena-platform/client" : "athena-platform/server";

const startCmd = isWeb
  ? { cmd: "npm", args: ["start"] }
  : { cmd: "node", args: ["dist/index.js"] };

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const cwd = path.join(process.cwd(), target);

run(startCmd.cmd, startCmd.args, cwd);