import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporary = await mkdtemp(join(tmpdir(), "oae-consumer-tools-"));
const project = join(temporary, "consumer");
const scaffold = join(root, "skills/oracle-apex-echarts/scripts/scaffold_consumer.py");
const updaterSource = join(root, "scripts/manage_oracle_apex_echarts.py");
const commit = "a".repeat(40);

function python(script, args, cwd = root) {
  return spawnSync("python3", [script, ...args], { cwd, encoding: "utf8" });
}

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
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

  test("peels an annotated tracking tag to the release commit", async () => {
    const upstream = join(temporary, "annotated-upstream");
    const checkout = join(temporary, "annotated-checkout");
    await mkdir(upstream);
    await mkdir(checkout);
    git(upstream, ["init", "--quiet"]);
    git(upstream, ["config", "user.name", "Synthetic Test"]);
    git(upstream, ["config", "user.email", "synthetic@example.invalid"]);
    await writeFile(join(upstream, "SKILL.md"), "synthetic\n", "utf8");
    git(upstream, ["add", "SKILL.md"]);
    git(upstream, ["commit", "--quiet", "-m", "synthetic"]);
    const expectedCommit = git(upstream, ["rev-parse", "HEAD"]);
    git(upstream, ["tag", "-a", "v1.0.0", "-m", "synthetic release"]);
    assert.notEqual(git(upstream, ["rev-parse", "v1.0.0"]), expectedCommit);

    git(checkout, ["init", "--quiet"]);
    git(checkout, ["fetch", "--quiet", "--depth", "1", upstream, "v1.0.0"]);
    const probe = [
      "import importlib.util, sys",
      "from pathlib import Path",
      "spec = importlib.util.spec_from_file_location('oae_manager', sys.argv[1])",
      "module = importlib.util.module_from_spec(spec)",
      "spec.loader.exec_module(module)",
      "print(module.resolve_fetched_commit(Path(sys.argv[2])))"
    ].join("; ");
    const result = spawnSync("python3", ["-c", probe, updaterSource, checkout], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), expectedCommit);
  });
});
