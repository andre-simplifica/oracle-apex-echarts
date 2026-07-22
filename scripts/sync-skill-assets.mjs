#!/usr/bin/env node
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const assets = join(root, "skills/oracle-apex-echarts/assets");

async function files(directory, base = directory) {
  const result = [];
  for (const entry of await readdir(directory)) {
    const path = join(directory, entry);
    const metadata = await stat(path);
    if (metadata.isDirectory()) result.push(...await files(path, base));
    else result.push(path.slice(base.length + 1).replaceAll("\\", "/"));
  }
  return result.sort();
}

for (const directory of ["schemas", "neutral-profile", "apex-distribution", "examples", "consumer"]) {
  await rm(join(assets, directory), { recursive: true, force: true });
  await mkdir(join(assets, directory), { recursive: true });
}

await cp(join(root, "schemas"), join(assets, "schemas"), { recursive: true });
await cp(join(root, "profiles/neutral.yaml"), join(assets, "neutral-profile/profile.yaml"));
await cp(join(root, "examples"), join(assets, "examples"), { recursive: true });
await cp(join(root, "build/plugin.sql"), join(assets, "apex-distribution/plugin.sql"));
await mkdir(join(assets, "apex-distribution/packages"), { recursive: true });
await cp(join(root, "src/plsql/pk_apex_echarts.pks"), join(assets, "apex-distribution/packages/pk_apex_echarts.pks"));
await cp(join(root, "src/plsql/pk_apex_echarts.pkb"), join(assets, "apex-distribution/packages/pk_apex_echarts.pkb"));
await cp(join(root, "src/installation/install.sql"), join(assets, "apex-distribution/install.sql"));
await cp(join(root, "src/installation/audit-installation.sql"), join(assets, "apex-distribution/audit-installation.sql"));
await cp(join(root, "src/installation/validate-installation.sql"), join(assets, "apex-distribution/validate-installation.sql"));
await cp(join(root, "src/installation/README.md"), join(assets, "apex-distribution/README.md"));
await cp(join(root, "compatibility.json"), join(assets, "apex-distribution/compatibility.json"));
await cp(join(root, "schemas"), join(assets, "apex-distribution/schemas"), { recursive: true });
await cp(join(root, "docs/installation"), join(assets, "apex-distribution/docs/installation"), { recursive: true });
await cp(join(root, "LICENSE"), join(assets, "apex-distribution/LICENSE"));
await cp(join(root, "NOTICE"), join(assets, "apex-distribution/NOTICE"));
const distribution = join(assets, "apex-distribution");
const distributionFiles = (await files(distribution)).filter((path) => path !== "SHA256SUMS");
const checksums = await Promise.all(distributionFiles.map(async (path) => {
  const digest = createHash("sha256").update(await readFile(join(distribution, path))).digest("hex");
  return `${digest}  ${path}`;
}));
await writeFile(join(distribution, "SHA256SUMS"), `${checksums.join("\n")}\n`, "utf8");
await cp(join(root, "scripts/manage_oracle_apex_echarts.py"), join(assets, "consumer/manage_oracle_apex_echarts.py"));
await cp(join(root, "docs/pt-BR/onboarding-equipe.md"), join(assets, "consumer/ONBOARDING-EQUIPE.md"));
console.log("OK: generated skill assets synchronized from canonical repository sources.");
