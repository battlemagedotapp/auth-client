import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
console.log(`Node ${process.version}; expected Node 24`);
if (Number(process.versions.node.split(".")[0]) !== 24) process.exitCode = 1;
spawnSync("pnpm", ["--version"], { stdio: "inherit" });
for (const file of ["examples/backend/.env.local", "examples/expo/.env.local"])
  console.log(`${file}: ${existsSync(file) ? "configured" : "missing; see README"}`);
const adb = process.env.ANDROID_HOME ? `${process.env.ANDROID_HOME}/platform-tools/adb` : undefined;
console.log(
  `Android adb: ${adb && existsSync(adb) ? "available" : "not configured (web development remains available)"}`,
);
