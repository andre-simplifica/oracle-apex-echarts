#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { extname, resolve } from "node:path";
import { parseDocument } from "yaml";
import { repositoryFiles } from "./repository-files.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const files = await repositoryFiles(root);
const textExtensions = new Set([".css", ".html", ".js", ".json", ".md", ".mjs", ".py", ".sql", ".yaml", ".yml"]);
const errors = [];
const unresolvedMarkers = new RegExp(`\\b(?:${["TO" + "DO", "FIX" + "ME"].join("|")})\\b`);

for (const file of files) {
  const extension = extname(file);
  if (!textExtensions.has(extension)) continue;
  if (/^vendor\/echarts\/echarts-.+\.min\.js$/.test(file)) continue;
  const source = await readFile(resolve(root, file), "utf8");
  if (/\r/.test(source)) errors.push(`${file}: CRLF is not allowed`);
  if (/[ \t]+$/m.test(source)) errors.push(`${file}: trailing whitespace`);
  if (!source.endsWith("\n")) errors.push(`${file}: missing final newline`);
  if (unresolvedMarkers.test(source)) errors.push(`${file}: unresolved work marker`);
  if ([".js", ".mjs"].includes(extension)) {
    const check = spawnSync(process.execPath, ["--check", resolve(root, file)], { encoding: "utf8" });
    if (check.status !== 0) errors.push(`${file}: ${check.stderr.trim()}`);
  }
  if (extension === ".json") {
    try { JSON.parse(source); } catch (error) { errors.push(`${file}: invalid JSON: ${error.message}`); }
  }
  if ([".yaml", ".yml"].includes(extension)) {
    const document = parseDocument(source, { uniqueKeys: true });
    for (const error of document.errors) errors.push(`${file}: invalid YAML: ${error.message}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`OK: linted ${files.length} repository files.`);
}
