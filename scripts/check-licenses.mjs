#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const vendor = resolve(root, "vendor/echarts");
const source = JSON.parse(await readFile(resolve(vendor, "SOURCE.json"), "utf8"));
const sums = new Map((await readFile(resolve(vendor, "SHA256SUMS"), "utf8"))
  .trim().split("\n").map((line) => {
    const [checksum, file] = line.trim().split(/\s{2,}/);
    return [file, checksum];
  }));
for (const required of ["LICENSE", "NOTICE", "LICENSE-d3", "KEYS", `echarts-${source.version}.min.js`]) {
  const content = await readFile(resolve(vendor, required));
  const actual = createHash("sha256").update(content).digest("hex");
  if (sums.get(required) !== actual) throw new Error(`Vendor checksum mismatch: ${required}`);
}
if (source.sourceRelease.status === "rejected-name-mismatch") {
  if (source.sourceRelease.acceptedAsBundleSource !== false) throw new Error("Rejected Apache source metadata must not be accepted as the bundle source.");
} else if (source.sourceRelease.status === "verified") {
  if (source.sourceRelease.signaturePublished !== source.sourceRelease.signatureVerified) throw new Error("Published Apache signature verification is incomplete.");
} else {
  throw new Error(`Unsupported Apache source provenance state: ${source.sourceRelease.status}`);
}
if (!source.npmDistribution.integrityVerified || !source.npmDistribution.bundleMatchedVendoredFile) throw new Error("npm provenance is incomplete.");
console.log(`OK: Apache ECharts ${source.version} licenses, notices, KEYS, SRI evidence, and SHA-256 checksums verified.`);
