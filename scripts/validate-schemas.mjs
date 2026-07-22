#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = resolve(new URL("..", import.meta.url).pathname);
const schemaDirectory = resolve(root, "schemas");
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
let count = 0;
const validators = new Map();
for (const name of (await readdir(schemaDirectory)).filter((entry) => entry.endsWith(".schema.json")).sort()) {
  const schema = JSON.parse(await readFile(resolve(schemaDirectory, name), "utf8"));
  validators.set(name, ajv.compile(schema));
  count += 1;
}

const chartFiles = [
  resolve(root, "tests/fixtures/valid-chart-spec.json"),
  resolve(root, "examples/states/no-data.json"),
  ...(await readdir(resolve(root, "examples/chart-types")))
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => join(root, "examples/chart-types", name))
];
const targets = [
  ["compatibility.schema.json", resolve(root, "compatibility.json")],
  ...chartFiles.map((path) => ["chart-spec.schema.json", path])
];
for (const [schemaName, path] of targets) {
  const validate = validators.get(schemaName);
  const value = JSON.parse(await readFile(path, "utf8"));
  if (!validate(value)) {
    throw new Error(`${path} does not match ${schemaName}: ${ajv.errorsText(validate.errors, { separator: "; " })}`);
  }
}
console.log(`OK: ${count} JSON Schemas compiled with Ajv draft 2020-12; ${targets.length} documents validated.`);
