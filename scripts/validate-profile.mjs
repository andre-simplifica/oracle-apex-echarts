#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { compileProjectProfile, stableJson } from "./profile.mjs";

const args = process.argv.slice(2);
function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
}

const positional = args.find((value, index) => !value.startsWith("-") && (index === 0 || !args[index - 1].startsWith("--")));
const profilePath = resolve(option("--profile") ?? positional ?? "profiles/neutral.yaml");
const projectRoot = resolve(option("--project-root") ?? dirname(profilePath));
const output = option("--output") ? resolve(option("--output")) : null;

try {
  const result = await compileProjectProfile(profilePath, { projectRoot });
  if (output) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, stableJson(result.profile), "utf8");
  }
  for (const notice of result.notices) console.log(`NOTICE: ${notice}`);
  console.log(`OK: profile 1.0 valid (${profilePath})`);
  if (output) console.log(`Compiled profile: ${output}`);
} catch (error) {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}
