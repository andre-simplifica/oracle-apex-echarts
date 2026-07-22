#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const root = resolve(new URL("..", import.meta.url).pathname);
const skillRoot = resolve(root, "skills/oracle-apex-echarts");
const source = await readFile(resolve(skillRoot, "SKILL.md"), "utf8");
const lines = source.split("\n");
if (lines.length > 500) throw new Error(`SKILL.md has ${lines.length} lines; maximum is 500.`);
const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
if (!match) throw new Error("SKILL.md frontmatter is missing.");
const frontmatter = parseYaml(match[1]);
if (Object.keys(frontmatter).sort().join(",") !== "description,name") throw new Error("SKILL.md frontmatter must contain only name and description.");
if (frontmatter.name !== "oracle-apex-echarts") throw new Error("Skill name must be oracle-apex-echarts.");
if (typeof frontmatter.description !== "string" || frontmatter.description.length < 80) throw new Error("Skill description is too short to trigger reliably.");

const agent = parseYaml(await readFile(resolve(skillRoot, "agents/openai.yaml"), "utf8"));
if (agent?.interface?.display_name !== "Oracle APEX ECharts") throw new Error("agents/openai.yaml display_name is invalid.");
if (!String(agent?.interface?.default_prompt ?? "").includes("$oracle-apex-echarts")) throw new Error("default_prompt must mention $oracle-apex-echarts.");
for (const path of [
  "references/architecture.md",
  "references/project-profile.md",
  "references/chart-selection.md",
  "references/chart-spec.md",
  "references/apex-plugin.md",
  "references/dynamic-content.md",
  "references/brand-report-kit-integration.md",
  "references/security-performance.md",
  "references/installation-upgrade.md",
  "references/upstream-maintenance.md",
  "references/validation.md",
  "scripts/validate_profile.py",
  "scripts/scaffold_consumer.py",
  "scripts/package_skill.py",
  "assets/apex-distribution/SHA256SUMS",
  "assets/apex-distribution/packages/pk_apex_echarts.pks",
  "assets/apex-distribution/packages/pk_apex_echarts.pkb",
  "assets/neutral-profile/profile.yaml",
  "assets/schemas/project-profile.schema.json"
]) await readFile(resolve(skillRoot, path));
console.log(`OK: skill metadata and progressive-disclosure shell validated (${lines.length} lines).`);
