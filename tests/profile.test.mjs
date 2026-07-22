import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { compileProjectProfile, resolveChartType, resolveDownload, validateProfile } from "../scripts/profile.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const temporaryDirectories = [];

async function temporaryProject(profileSource = null) {
  const project = await mkdtemp(join(tmpdir(), "oae-profile-test-"));
  temporaryDirectories.push(project);
  const profile = join(project, "profile.yaml");
  await writeFile(profile, profileSource ?? await readFile(join(root, "examples/neutral-profile/profile.yaml"), "utf8"), "utf8");
  return { project, profile };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("project profile 1.0", () => {
  test("uses the neutral fallback and reports the missing automatic brand profile", async () => {
    const { project, profile } = await temporaryProject();
    const result = await compileProjectProfile(profile, { projectRoot: project });
    assert.equal(result.profile.schemaVersion, "1.0");
    assert.equal(result.profile.visual.resolvedTokens.palette[0], "#2563EB");
    assert.ok(result.notices.some((notice) => notice.includes("using the neutral profile")));
  });

  test("maps an explicit Oracle APEX Brand Report Kit profile", async () => {
    const source = await readFile(join(root, "examples/brand-report-kit/profile.yaml"), "utf8");
    const { project, profile } = await temporaryProject(source);
    await mkdir(join(project, ".apex-brand-report-kit"), { recursive: true });
    await cp(join(root, "examples/brand-report-kit/brand-profile.json"), join(project, ".apex-brand-report-kit/brand-profile.json"));
    const result = await compileProjectProfile(profile, { projectRoot: project });
    assert.equal(result.profile.visual.resolvedTokens.palette[0], "#123C69");
    assert.match(result.profile.visual.resolvedTokens.fontFamily, /Inter/);
    assert.equal(result.profile.visual.resolvedTokens.reducedMotion, true);
  });

  test("keeps the standalone Python compiler aligned with the canonical Node compiler", async () => {
    const source = await readFile(join(root, "examples/brand-report-kit/profile.yaml"), "utf8");
    const { project, profile } = await temporaryProject(source);
    await mkdir(join(project, ".apex-brand-report-kit"), { recursive: true });
    await cp(join(root, "examples/brand-report-kit/brand-profile.json"), join(project, ".apex-brand-report-kit/brand-profile.json"));
    const expected = (await compileProjectProfile(profile, { projectRoot: project })).profile;
    const output = join(project, "compiled-profile.json");
    const validator = join(root, "skills/oracle-apex-echarts/scripts/validate_profile.py");
    const result = spawnSync("python3", [validator, profile, "--project-root", project, "--compile-output", output], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(await readFile(output, "utf8")), expected);
  });

  test("fails clearly when an explicit brand provider is missing", async () => {
    const source = await readFile(join(root, "examples/brand-report-kit/profile.yaml"), "utf8");
    const { project, profile } = await temporaryProject(source);
    await assert.rejects(() => compileProjectProfile(profile, { projectRoot: project }), /required and invalid or missing/);
  });

  test("applies project visual overrides after Brand Report Kit tokens", async () => {
    const parsed = parseYaml(await readFile(join(root, "examples/brand-report-kit/profile.yaml"), "utf8"));
    parsed.visual.overrides.palette = ["#010203", "#040506"];
    const { project, profile } = await temporaryProject(stringifyYaml(parsed));
    await mkdir(join(project, ".apex-brand-report-kit"), { recursive: true });
    await cp(join(root, "examples/brand-report-kit/brand-profile.json"), join(project, ".apex-brand-report-kit/brand-profile.json"));
    const result = await compileProjectProfile(profile, { projectRoot: project });
    assert.deepEqual(result.profile.visual.resolvedTokens.palette, ["#010203", "#040506"]);
  });

  test("selects bar for comparison and line for trend without misusing preference", async () => {
    const { project, profile } = await temporaryProject();
    const compiled = (await compileProjectProfile(profile, { projectRoot: project })).profile;
    assert.deepEqual(resolveChartType({ question: "comparison", profile: compiled }), { type: "bar", reason: "project-preference" });
    assert.deepEqual(resolveChartType({ question: "trend", profile: compiled }), { type: "line", reason: "managerial-fit" });
    assert.deepEqual(resolveChartType({ question: "trend", requestedType: "area", profile: compiled }), { type: "area", reason: "explicit-task-request" });
    compiled.charts.preferencePolicy = "require";
    assert.throws(() => resolveChartType({ question: "trend", profile: compiled }), /not appropriate/);
  });

  test("enforces never, allow, and always download policies with server authorization", async () => {
    const { project, profile } = await temporaryProject();
    const compiled = (await compileProjectProfile(profile, { projectRoot: project })).profile;
    assert.equal(resolveDownload({ profile: compiled, chartRequested: true, serverAuthorized: true }), false);
    compiled.behavior.downloadPolicy = "allow";
    assert.equal(resolveDownload({ profile: compiled, chartRequested: false, serverAuthorized: true }), false);
    assert.equal(resolveDownload({ profile: compiled, chartRequested: true, serverAuthorized: true }), true);
    compiled.behavior.downloadPolicy = "always";
    assert.equal(resolveDownload({ profile: compiled, serverAuthorized: true }), true);
    assert.equal(resolveDownload({ profile: compiled, serverAuthorized: false }), false);
  });

  test("rejects unknown keys and unsafe profile behavior", async () => {
    const profile = parseYaml(await readFile(join(root, "examples/neutral-profile/profile.yaml"), "utf8"));
    profile.visual.eval = true;
    const errors = await validateProfile(profile);
    assert.ok(errors.some((error) => error.includes("additional properties")));
  });
});
