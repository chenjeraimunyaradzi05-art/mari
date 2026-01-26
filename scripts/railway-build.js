const { spawnSync } = require("node:child_process");
const path = require("node:path");

const serviceName = (process.env.RAILWAY_SERVICE_NAME || "").toLowerCase();

const isWeb = serviceName.includes("web") || serviceName.includes("client") || serviceName.includes("frontend");
const isApi = serviceName.includes("api") || serviceName.includes("server") || serviceName.includes("backend");

const target = isWeb ? "athena-platform/client" : "athena-platform/server";

const installCmd = isWeb
  ? { cmd: "npm", args: ["install", "--legacy-peer-deps"] }
  : { cmd: "npm", args: ["install"] };

const buildCmd = isWeb
  ? { cmd: "npm", args: ["run", "build"] }
  : { cmd: "npm", args: ["run", "build"] };

const prismaCmd = isApi
  ? { cmd: "npx", args: ["prisma", "generate"] }
  : null;

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const cwd = path.join(process.cwd(), target);

run(installCmd.cmd, installCmd.args, cwd);

if (prismaCmd) {
  run(prismaCmd.cmd, prismaCmd.args, cwd);
}

run(buildCmd.cmd, buildCmd.args, cwd);