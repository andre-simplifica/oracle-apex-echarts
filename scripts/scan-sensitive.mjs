#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { repositoryFiles } from "./repository-files.mjs";

const root = resolve(new URL("..", import.meta.url).pathname);
const textExtensions = new Set([".css", ".html", ".js", ".json", ".md", ".mjs", ".py", ".sql", ".yaml", ".yml"]);
const forbidden = [
  [/\bDikoko\b/i, "private project identity"],
  [/\bFAZENDA2\b/i, "production schema"],
  [/\bMALIBRU\b/i, "production service"],
  [/(?:^|["'\s])\/Users\//m, "personal filesystem path"],
  [/oraclecloudapps\.com/i, "private Oracle Cloud URL"],
  [/\b(?:gh[opurs]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/, "GitHub token"],
  [/\b(?:password|passwd|secret|api[_-]?key)\s*[:=]\s*["'][^"']+["']/i, "embedded credential"],
  [/\b(?:application|workspace)[_-]?id\s*[:=]>?\s*(?:100|127|128)\b/i, "known real APEX identifier"]
];
const errors = [];
for (const file of await repositoryFiles(root)) {
  if (!textExtensions.has(extname(file))) continue;
  if (file === "vendor/echarts/KEYS" || /^vendor\/echarts\/echarts-.+\.min\.js$/.test(file)) continue;
  const source = await readFile(resolve(root, file), "utf8");
  for (const [pattern, label] of forbidden) {
    if (pattern.test(source)) errors.push(`${file}: ${label}`);
  }
  if (file === "scripts/scan-sensitive.mjs") continue;
  for (const match of source.matchAll(/simplifica/gi)) {
    const lineStart = source.lastIndexOf("\n", match.index) + 1;
    const lineEnd = source.indexOf("\n", match.index);
    const line = source.slice(lineStart, lineEnd < 0 ? source.length : lineEnd);
    if (!/com(?:\\?\.|_)simplifica(?:\\?\.|_)apex(?:\\?\.|_)echarts|andre-simplifica/i.test(line)) {
      errors.push(`${file}: non-technical Simplifica identity`);
    }
  }
}

if (errors.length > 0) {
  console.error([...new Set(errors)].join("\n"));
  process.exitCode = 1;
} else {
  console.log("OK: no private project identity, production identifiers, personal paths, private URLs, or credential patterns found.");
}
