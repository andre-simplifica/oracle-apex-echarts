#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const release = join(root, "dist/release");

async function releaseDigest() {
  const hash = createHash("sha256");
  for (const name of (await readdir(release)).sort()) {
    hash.update(name);
    hash.update(await readFile(join(release, name)));
  }
  return hash.digest("hex");
}

const initialDigest = await releaseDigest();
const sums = (await readFile(join(release, "SHA256SUMS"), "utf8")).trim().split("\n");
for (const row of sums) {
  const [expected, name] = row.split(/\s{2,}/);
  const actual = createHash("sha256").update(await readFile(join(release, name))).digest("hex");
  if (actual !== expected) throw new Error(`release checksum mismatch: ${name}`);
}
for (const name of (await readdir(release)).filter((entry) => entry.endsWith(".zip"))) {
  if (!(await stat(join(release, name))).isFile()) throw new Error(`not a file: ${name}`);
  const result = spawnSync("unzip", ["-t", join(release, name)], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`invalid ZIP: ${name}`);
}
const plugin = await readFile(join(release, "plugin.sql"), "utf8");
if (/https?:\/\/(?:cdn|unpkg|jsdelivr)/i.test(plugin)) throw new Error("plug-in export contains a CDN URL");
if (!plugin.includes("COM.SIMPLIFICA.APEX.ECHARTS") || !plugin.includes("Apache ECharts for Oracle APEX")) throw new Error("plug-in identity is invalid");
const rebuild = spawnSync(process.execPath, [join(root, "scripts/build-distribution.mjs")], { cwd: root, encoding: "utf8" });
if (rebuild.status !== 0) throw new Error(`deterministic rebuild failed: ${rebuild.stderr || rebuild.stdout}`);
const rebuiltDigest = await releaseDigest();
if (initialDigest !== rebuiltDigest) throw new Error(`distribution is not deterministic: ${initialDigest} != ${rebuiltDigest}`);
console.log(`OK: ${sums.length} release checksums and all ZIPs verified; deterministic digest ${rebuiltDigest}; runtime has no CDN fallback.`);
