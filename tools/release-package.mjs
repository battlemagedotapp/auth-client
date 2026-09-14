import { cp, mkdir, mkdtemp, readFile, writeFile, appendFile, rm, symlink } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const root = resolve(".");
const defaultParentDirectory = join(root, "artifacts");

export async function prepareRelease({ parentDirectory = defaultParentDirectory } = {}) {
  const source = join(root, "packages/auth-client");
  const manifest = JSON.parse(await readFile(join(source, "package.json"), "utf8"));
  await mkdir(parentDirectory, { recursive: true });
  const directory = await mkdtemp(join(parentDirectory, "release-"));
  for (const file of manifest.files.filter((file) => file !== "dist")) {
    await cp(join(source, file), join(directory, file), { recursive: true });
  }
  // Release snapshots are installable without lifecycle scripts or build tooling.
  const {
    scripts: _scripts,
    devDependencies: _dev,
    packageManager: _manager,
    ...published
  } = manifest;
  await writeFile(join(directory, "package.json"), JSON.stringify(published, null, 2) + "\n");
  // Compile the copied sources so emitted map paths resolve within the package.
  const config = join(directory, "tsconfig.build.json");
  await cp(join(source, "tsconfig.build.json"), config);
  // Resolve package dependencies at the release root and repository tooling
  // through its temporary parent, matching TypeScript's normal ancestor lookup.
  const dependencies = join(directory, "node_modules");
  const toolingDependencies = join(parentDirectory, "node_modules");
  await symlink(join(source, "node_modules"), dependencies, "dir");
  await symlink(join(root, "node_modules"), toolingDependencies, "dir");
  try {
    execFileSync("pnpm", ["exec", "tsc", "-p", config], { cwd: root, stdio: "inherit" });
  } finally {
    await rm(config);
    await rm(dependencies);
    await rm(toolingDependencies);
  }
  return { directory, version: manifest.version };
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const release = await prepareRelease();
  console.log(JSON.stringify(release));
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `directory=${release.directory}\nversion=${release.version}\n`,
    );
  }
}
