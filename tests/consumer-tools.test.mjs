import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporary = await mkdtemp(join(tmpdir(), "oae-consumer-tools-"));
const project = join(temporary, "consumer");
const scaffold = join(root, "skills/oracle-apex-echarts/scripts/scaffold_consumer.py");
const commit = "a".repeat(40);

function python(script, args, cwd = root) {
  return spawnSync("python3", [script, ...args], { cwd, encoding: "utf8" });
}

after(async () => rm(temporary, { recursive: true, force: true }));

describe("consumer skill tooling", () => {
  test("scaffolds only the managed skill and project-owned configuration", async () => {
    const dryRun = python(scaffold, ["--project", project, "--commit", commit]);
    assert.equal(dryRun.status, 0, dryRun.stderr);
    assert.match(dryRun.stdout, /DRY-RUN/);

    const apply = python(scaffold, ["--project", project, "--commit", commit, "--apply"]);
    assert.equal(apply.status, 0, apply.stderr);
    assert.match(await readFile(join(project, ".agents/skills/oracle-apex-echarts/SKILL.md"), "utf8"), /^---/);
    assert.match(await readFile(join(project, ".oracle-apex-echarts/profile.yaml"), "utf8"), /schemaVersion: "1\.0"/);
    const lock = JSON.parse(await readFile(join(project, ".oracle-apex-echarts/upstream-lock.json"), "utf8"));
    assert.equal(lock.installed_commit, commit);
    assert.ok(lock.files.some((entry) => entry.path === "SKILL.md"));
    assert.ok(lock.files.every((entry) => /^[0-9a-f]{64}$/.test(entry.sha256)));

    const validator = join(project, ".agents/skills/oracle-apex-echarts/scripts/validate_profile.py");
    const profileValidation = python(validator, [join(project, ".oracle-apex-echarts/profile.yaml"), "--project-root", project], project);
    assert.equal(profileValidation.status, 0, profileValidation.stderr);
  });

  test("reports integrity, refuses overwrite, and blocks local drift or symlinks", async () => {
    const updater = join(project, "Util/scripts/manage_oracle_apex_echarts.py");
    const status = python(updater, ["status"], project);
    assert.equal(status.status, 0, status.stderr);
    assert.match(status.stdout, /skill íntegra/);

    const overwrite = python(scaffold, ["--project", project, "--commit", commit, "--apply"]);
    assert.notEqual(overwrite.status, 0);
    assert.match(overwrite.stderr, /refusing to overwrite/);

    const link = join(project, ".agents/skills/oracle-apex-echarts/synthetic-link");
    await symlink("SKILL.md", link);
    const linkedStatus = python(updater, ["status"], project);
    assert.notEqual(linkedStatus.status, 0);
    assert.match(linkedStatus.stderr, /Link simbólico não permitido/);
    await unlink(link);

    const skill = join(project, ".agents/skills/oracle-apex-echarts/SKILL.md");
    await writeFile(skill, `${await readFile(skill, "utf8")}\nlocal customization\n`, "utf8");
    const driftedStatus = python(updater, ["status"], project);
    assert.notEqual(driftedStatus.status, 0);
    assert.match(driftedStatus.stderr, /divergiu do lock/);
  });
});
