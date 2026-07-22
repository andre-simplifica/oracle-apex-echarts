#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const compatibility = JSON.parse(await readFile(join(root, "compatibility.json"), "utf8"));
const candidate = join(root, "build/dist-candidate");
const unpacked = join(candidate, "apex");
const release = join(candidate, "release");
const finalDist = join(root, "dist");
const normalizedTime = new Date("2000-01-01T00:00:00.000Z");

async function files(directory, base = directory) {
  const result = [];
  for (const entry of await readdir(directory)) {
    const path = join(directory, entry);
    const metadata = await stat(path);
    if (metadata.isDirectory()) result.push(...await files(path, base));
    else result.push(relative(base, path).replaceAll("\\", "/"));
  }
  return result.sort();
}

async function checksum(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function copy(source, destination) {
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true });
}

async function normalize(directory) {
  for (const path of await files(directory)) await utimes(join(directory, path), normalizedTime, normalizedTime);
}

async function zip(directory, output, entries) {
  const result = spawnSync("zip", ["-X", "-9", output, ...entries], {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, TZ: "UTC" }
  });
  if (result.status !== 0) throw new Error(`zip failed: ${result.stderr || result.stdout}`);
  const check = spawnSync("unzip", ["-t", output], { encoding: "utf8" });
  if (check.status !== 0) throw new Error(`ZIP integrity failed: ${check.stderr || check.stdout}`);
}

await rm(candidate, { recursive: true, force: true });
await mkdir(unpacked, { recursive: true });
await mkdir(release, { recursive: true });

const apexCopies = [
  ["build/plugin.sql", "plugin.sql"],
  ["src/plsql/pk_apex_echarts.pks", "packages/pk_apex_echarts.pks"],
  ["src/plsql/pk_apex_echarts.pkb", "packages/pk_apex_echarts.pkb"],
  ["src/installation/install.sql", "install.sql"],
  ["src/installation/audit-installation.sql", "audit-installation.sql"],
  ["src/installation/validate-installation.sql", "validate-installation.sql"],
  ["src/installation/README.md", "README.md"],
  ["LICENSE", "LICENSE"],
  ["NOTICE", "NOTICE"],
  ["compatibility.json", "compatibility.json"],
  ["schemas/chart-spec.schema.json", "schemas/chart-spec.schema.json"],
  ["schemas/project-profile.schema.json", "schemas/project-profile.schema.json"],
  ["schemas/compatibility.schema.json", "schemas/compatibility.schema.json"],
  ["profiles/neutral.yaml", "profiles/neutral.yaml"],
  ["docs/installation", "docs/installation"],
  ["docs/maintenance", "docs/maintenance"],
  ["vendor/echarts", "vendor/echarts"]
];
for (const [source, destination] of apexCopies) await copy(join(root, source), join(unpacked, destination));

const payload = (await files(unpacked)).filter((path) => path !== "SHA256SUMS");
await writeFile(join(unpacked, "SHA256SUMS"), `${(await Promise.all(payload.map(async (path) => `${await checksum(join(unpacked, path))}  ${path}`))).join("\n")}\n`, "utf8");
await normalize(unpacked);
const apexZipName = `oracle-apex-echarts-apex-${compatibility.project}.zip`;
await zip(unpacked, join(release, apexZipName), await files(unpacked));

const skillZipName = `oracle-apex-echarts-skill-${compatibility.skill}.zip`;
const skillPackage = spawnSync("python3", [join(root, "skills/oracle-apex-echarts/scripts/package_skill.py"), "--output", join(release, skillZipName)], { cwd: root, encoding: "utf8" });
if (skillPackage.status !== 0) throw new Error(`skill package failed: ${skillPackage.stderr || skillPackage.stdout}`);

const releaseCopies = [
  ["build/plugin.sql", "plugin.sql"],
  ["src/plsql/pk_apex_echarts.pks", "pk_apex_echarts.pks"],
  ["src/plsql/pk_apex_echarts.pkb", "pk_apex_echarts.pkb"],
  ["src/installation/install.sql", "install.sql"],
  ["src/installation/audit-installation.sql", "audit-installation.sql"],
  ["src/installation/validate-installation.sql", "validate-installation.sql"],
  ["schemas/chart-spec.schema.json", "chart-spec.schema.json"],
  ["schemas/project-profile.schema.json", "project-profile.schema.json"],
  ["schemas/compatibility.schema.json", "compatibility.schema.json"],
  ["compatibility.json", "compatibility.json"],
  ["LICENSE", "PROJECT-LICENSE"],
  ["NOTICE", "PROJECT-NOTICE"],
  [`vendor/echarts/echarts-${compatibility.echarts}.min.js`, `echarts-${compatibility.echarts}.min.js`],
  ["vendor/echarts/LICENSE", "ECHARTS-LICENSE"],
  ["vendor/echarts/NOTICE", "ECHARTS-NOTICE"],
  ["vendor/echarts/LICENSE-d3", "ECHARTS-LICENSE-d3"],
  ["vendor/echarts/SOURCE.json", "ECHARTS-SOURCE.json"],
  ["vendor/echarts/SHA256SUMS", "ECHARTS-SHA256SUMS"],
  ["vendor/echarts/KEYS", "ECHARTS-KEYS"]
];
for (const [source, destination] of releaseCopies) await copy(join(root, source), join(release, destination));

const releaseFiles = (await files(release)).filter((path) => path !== "SHA256SUMS");
await writeFile(join(release, "SHA256SUMS"), `${(await Promise.all(releaseFiles.map(async (path) => `${await checksum(join(release, path))}  ${path}`))).join("\n")}\n`, "utf8");
await normalize(candidate);

const zipChecks = [apexZipName, skillZipName].map((name) => spawnSync("unzip", ["-t", join(release, name)], { encoding: "utf8" }));
if (zipChecks.some((result) => result.status !== 0)) throw new Error("candidate ZIP validation failed");
const plugin = await readFile(join(release, "plugin.sql"), "utf8");
for (const file of [`echarts-${compatibility.echarts}.min.js`, "oracle-apex-echarts.js", "oracle-apex-echarts.css", "SOURCE.json", "SHA256SUMS"]) {
  if (!plugin.includes(`p_file_name=>'${file}'`)) throw new Error(`plug-in export is missing ${file}`);
}

await rm(finalDist, { recursive: true, force: true });
await rename(candidate, finalDist);
console.log(`OK: deterministic release candidate built in ${finalDist}`);
console.log(`APEX ZIP: ${apexZipName}`);
console.log(`Skill ZIP: ${skillZipName}`);
