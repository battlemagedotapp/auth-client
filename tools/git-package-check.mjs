import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

import { prepareRelease } from "./release-package.mjs";

// Only the temporary distribution fixture gets commits and tags.
const root = resolve(".");
const { directory: repository } = await prepareRelease();
const git = (...args) =>
  execFileSync("git", args, { cwd: repository, encoding: "utf8", stdio: "pipe" });
git("init", "--quiet");
git("add", ".");
git(
  "-c",
  "user.name=Package fixture",
  "-c",
  "user.email=fixture@example.invalid",
  "-c",
  "commit.gpgsign=false",
  "-c",
  "core.hooksPath=/dev/null",
  "commit",
  "--quiet",
  "-m",
  "Installation fixture",
);
const manifestPath = join(repository, "package.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const tag = `v${manifest.version}`;
git("tag", tag);
// A later development commit must not change what the release installs.
await writeFile(manifestPath, JSON.stringify({ ...manifest, version: "0.0.0-development" }));
git("add", ".");
git(
  "-c",
  "user.name=Package fixture",
  "-c",
  "user.email=fixture@example.invalid",
  "-c",
  "commit.gpgsign=false",
  "-c",
  "core.hooksPath=/dev/null",
  "commit",
  "--quiet",
  "-m",
  "Later development work",
);
const source = `git+${pathToFileURL(repository).href}#${tag}`;
execFileSync(process.execPath, [join(root, "tools/package-check.mjs")], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    AUTH_CLIENT_GIT_SOURCE: source,
    AUTH_CLIENT_EXPECTED_VERSION: manifest.version,
  },
});
