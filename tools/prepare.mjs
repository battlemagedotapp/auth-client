import { spawnSync } from "node:child_process";
const git = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { stdio: "ignore" });
if (git.status === 0) {
  const result = spawnSync("pnpm", ["exec", "husky"], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
}
