#!/usr/bin/env node
import { createHash } from "node:crypto";
import { appendFile, cp, lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import * as openpgp from "openpgp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const compatibilityPath = join(root, "compatibility.json");

export function isStableVersion(version) {
  return /^[0-9]+\.[0-9]+\.[0-9]+$/.test(version);
}

export function compareVersions(left, right) {
  if (!isStableVersion(left) || !isStableVersion(right)) throw new Error("Version comparison requires stable X.Y.Z values.");
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

export function validateUpdateTarget(currentVersion, targetVersion) {
  if (!isStableVersion(targetVersion)) {
    throw new Error("--version must be an explicit stable X.Y.Z version; prereleases and nightly builds are rejected.");
  }
  if (!isStableVersion(currentVersion)) throw new Error("The vendored ECharts version is not a stable X.Y.Z value.");
  const comparison = compareVersions(targetVersion, currentVersion);
  if (comparison < 0) throw new Error("ECharts downgrade is not supported by the updater.");
  if (comparison === 0) throw new Error("Requested ECharts version is already vendored.");
  return { majorReview: Number(targetVersion.split(".")[0]) > Number(currentVersion.split(".")[0]) };
}

export function parseSha512File(source, expectedFileName) {
  const rows = source.trim().split(/\r?\n/).filter(Boolean);
  if (rows.length !== 1) throw new Error("Apache SHA-512 file must contain exactly one entry.");
  const match = /^([0-9a-fA-F]{128})\s+[*]?(.+)$/.exec(rows[0].trim());
  if (!match) throw new Error("Apache SHA-512 payload has an invalid format.");
  if (match[2] !== expectedFileName) {
    throw new Error(`Apache checksum names ${match[2]}, expected ${expectedFileName}; candidate rejected.`);
  }
  return match[1].toLowerCase();
}

export function verifySri(buffer, integrity) {
  const match = /^sha512-([A-Za-z0-9+/]+={0,2})$/.exec(integrity ?? "");
  if (!match) throw new Error("npm package does not publish a valid SHA-512 SRI value.");
  const actual = createHash("sha512").update(buffer).digest("base64");
  if (actual !== match[1]) throw new Error("npm tarball SHA-512 SRI verification failed.");
  return true;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function fetchResponse(url, optional = false) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: { "user-agent": "oracle-apex-echarts-updater/1.0.1" },
        signal: AbortSignal.timeout(15000)
      });
      if (optional && response.status === 404) return null;
      if (response.ok) return response;
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable) throw new Error(`HTTP ${response.status} from ${url}`);
      lastError = new Error(`HTTP ${response.status} from ${url}`);
    } catch (error) {
      lastError = error;
      if (/HTTP 4\d\d/.test(error.message) && !/HTTP 429/.test(error.message)) throw error;
    }
    if (attempt < 3) await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 250));
  }
  throw new Error(`Unable to fetch ${url} after 3 attempts: ${lastError?.message ?? "unknown network error"}`);
}

async function fetchJson(url) {
  return (await fetchResponse(url)).json();
}

async function fetchBytes(url) {
  return Buffer.from(await (await fetchResponse(url)).arrayBuffer());
}

async function resolveGitHubTag(version) {
  let object = (await fetchJson(`https://api.github.com/repos/apache/echarts/git/ref/tags/${version}`)).object;
  if (object.type === "tag") object = (await fetchJson(object.url)).object;
  if (object.type !== "commit" || !/^[0-9a-f]{40}$/.test(object.sha)) throw new Error("GitHub tag does not resolve to a commit.");
  return object.sha;
}

async function resolveGitHubRelease(version) {
  const release = await fetchJson(`https://api.github.com/repos/apache/echarts/releases/tags/${version}`);
  if (release.tag_name !== version || release.draft || release.prerelease || !release.html_url) {
    throw new Error(`GitHub does not publish a stable release for tag ${version}.`);
  }
  return release.html_url;
}

async function verifyOpenPgp(archive, signature, keys) {
  const verificationKeys = await openpgp.readKeys({ armoredKeys: keys.toString("utf8") });
  const message = await openpgp.createMessage({ binary: archive });
  const detached = await openpgp.readSignature({ armoredSignature: signature.toString("utf8") });
  const result = await openpgp.verify({ message, signature: detached, verificationKeys });
  if (result.signatures.length === 0) throw new Error("OpenPGP signature contains no verifiable signer.");
  for (const entry of result.signatures) await entry.verified;
  return result.signatures.map((entry) => entry.keyID.toHex());
}

async function apacheSource(version) {
  const base = `https://downloads.apache.org/echarts/${version}`;
  const archiveName = `apache-echarts-${version}-src.zip`;
  const archiveUrl = `${base}/${archiveName}`;
  const checksumUrl = `${archiveUrl}.sha512`;
  const signatureUrl = `${archiveUrl}.asc`;
  const keysUrl = "https://downloads.apache.org/echarts/KEYS";
  const checksumText = await (await fetchResponse(checksumUrl)).text();
  const expectedSha512 = parseSha512File(checksumText, archiveName);
  const archive = await fetchBytes(archiveUrl);
  const actualSha512 = createHash("sha512").update(archive).digest("hex");
  if (actualSha512 !== expectedSha512) throw new Error("Apache source archive SHA-512 verification failed.");
  const signatureResponse = await fetchResponse(signatureUrl, true);
  const keys = await fetchBytes(keysUrl);
  let signingKeyIds = [];
  let signaturePublished = false;
  if (signatureResponse) {
    signaturePublished = true;
    signingKeyIds = await verifyOpenPgp(archive, Buffer.from(await signatureResponse.arrayBuffer()), keys);
  }
  return { archiveName, archiveUrl, checksumUrl, signatureUrl, keysUrl, expectedSha512, signaturePublished, signingKeyIds, keys };
}

async function npmDistribution(version, temporary) {
  const metadataUrl = `https://registry.npmjs.org/echarts/${version}`;
  const metadata = await fetchJson(metadataUrl);
  if (metadata.version !== version || !isStableVersion(metadata.version)) throw new Error("npm metadata version is not the requested stable version.");
  const tarball = await fetchBytes(metadata.dist.tarball);
  verifySri(tarball, metadata.dist.integrity);
  const archivePath = join(temporary, `echarts-${version}.tgz`);
  await writeFile(archivePath, tarball);
  const extract = spawnSync("tar", ["-xzf", archivePath, "-C", temporary], { encoding: "utf8" });
  if (extract.status !== 0) throw new Error(`Unable to extract npm tarball: ${extract.stderr}`);
  const packageRoot = join(temporary, "package");
  const files = {
    bundle: await readFile(join(packageRoot, "dist/echarts.min.js")),
    license: await readFile(join(packageRoot, "LICENSE")),
    notice: await readFile(join(packageRoot, "NOTICE")),
    d3License: await readFile(join(packageRoot, "licenses/LICENSE-d3"))
  };
  return { metadataUrl, metadata, tarball, packageRoot, files };
}

function nextPatch(version) {
  const [major, minor, patch] = version.split(".").map(Number);
  return `${major}.${minor}.${patch + 1}`;
}

async function writeGitHubOutput(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  const rows = [];
  for (const [key, value] of Object.entries(values)) {
    rows.push(`${key}<<OAE_EOF\n${value}\nOAE_EOF\n`);
  }
  await appendFile(process.env.GITHUB_OUTPUT, rows.join(""), "utf8");
}

export async function checkUpstream() {
  const compatibility = JSON.parse(await readFile(compatibilityPath, "utf8"));
  const latest = await fetchJson("https://registry.npmjs.org/echarts/latest");
  if (!isStableVersion(latest.version)) throw new Error(`npm latest is not stable: ${latest.version}`);
  const updateAvailable = compareVersions(latest.version, compatibility.echarts) > 0;
  const releaseUrl = await resolveGitHubRelease(latest.version);
  const tagCommit = await resolveGitHubTag(latest.version);
  const changelogUrl = "https://echarts.apache.org/en/changelog.html";
  const changelog = await (await fetchResponse(changelogUrl)).text();
  if (!changelog.includes(`v${latest.version}`)) throw new Error(`Official changelog does not list v${latest.version}.`);
  const sourceArchiveName = `apache-echarts-${latest.version}-src.zip`;
  const apacheUrl = `https://downloads.apache.org/echarts/${latest.version}/${sourceArchiveName}`;
  let apacheChecksumStatus;
  let apacheChecksumSeverity;
  try {
    const checksumText = await (await fetchResponse(`${apacheUrl}.sha512`)).text();
    parseSha512File(checksumText, sourceArchiveName);
    apacheChecksumStatus = "checksum entry names the expected source archive";
    apacheChecksumSeverity = "ok";
  } catch (error) {
    apacheChecksumStatus = `canonical Apache checksum warning: ${error.message}`;
    apacheChecksumSeverity = "warning";
  }
  const body = [
    `Current vendored version: ${compatibility.echarts}`,
    `Latest stable version: ${latest.version}`,
    `Official GitHub release: ${releaseUrl}`,
    `Official tag commit: ${tagCommit}`,
    `Official changelog: ${changelogUrl}`,
    `Official Apache source distribution: ${apacheUrl}`,
    `Apache source metadata: ${apacheChecksumStatus}`,
    `Official npm package: https://www.npmjs.com/package/echarts/v/${latest.version}`,
    "No bundle or release was changed automatically."
  ].join("\n\n");
  const result = {
    current: compatibility.echarts,
    latest: latest.version,
    updateAvailable,
    releaseUrl,
    releasePublished: true,
    tagCommit,
    changelogUrl,
    changelogListsVersion: true,
    apacheUrl,
    apacheChecksumSeverity,
    apacheChecksumStatus,
    body
  };
  console.log(JSON.stringify(result, null, 2));
  await writeGitHubOutput({
    current: result.current,
    latest: result.latest,
    update_available: String(result.updateAvailable),
    issue_title: `Apache ECharts ${result.latest} is available`,
    issue_body: result.body
  });
  return result;
}

function replaceExact(source, oldValue, newValue, label) {
  if (!source.includes(oldValue)) throw new Error(`Unable to update ${label}; expected value not found.`);
  return source.replaceAll(oldValue, newValue);
}

async function updateText(path, replacements, backups) {
  const source = await readFile(path, "utf8");
  let target = source;
  for (const [oldValue, newValue, label] of replacements) target = replaceExact(target, oldValue, newValue, label);
  backups.set(path, Buffer.from(source));
  await writeFile(path, target, "utf8");
}

async function snapshotGenerated(paths, temporary) {
  const backupRoot = join(temporary, "generated-rollback");
  await mkdir(backupRoot, { recursive: true });
  const entries = [];
  for (const [index, path] of paths.entries()) {
    const backup = join(backupRoot, String(index));
    let existed = true;
    try {
      await lstat(path);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      existed = false;
    }
    if (existed) await cp(path, backup, { recursive: true });
    entries.push({ path, backup, existed });
  }
  return async () => {
    for (const entry of entries) {
      await rm(entry.path, { recursive: true, force: true });
      if (entry.existed) await cp(entry.backup, entry.path, { recursive: true });
    }
  };
}

async function updateUpstream(version, options) {
  if (options.apply === options.dryRun) throw new Error("Choose exactly one of --dry-run or --apply.");
  const compatibility = JSON.parse(await readFile(compatibilityPath, "utf8"));
  const targetMajor = Number(version.split(".")[0]);
  const { majorReview } = validateUpdateTarget(compatibility.echarts, version);

  const temporary = await mkdtemp(join(tmpdir(), "oracle-apex-echarts-upstream-"));
  try {
    const npm = await npmDistribution(version, temporary);
    const apache = await apacheSource(version);
    const releaseUrl = await resolveGitHubRelease(version);
    const commit = await resolveGitHubTag(version);
    const newProjectVersion = nextPatch(compatibility.project);
    const report = [
      `# Apache ECharts ${version} update candidate`,
      "",
      `- Current ECharts: ${compatibility.echarts}`,
      `- Candidate ECharts: ${version}`,
      `- Candidate Git commit: ${commit}`,
      `- Official GitHub release: ${releaseUrl}`,
      `- npm SRI: ${npm.metadata.dist.integrity}`,
      `- Bundle SHA-256: ${sha256(npm.files.bundle)}`,
      `- Apache source SHA-512: ${apache.expectedSha512}`,
      `- Apache signature: ${apache.signaturePublished ? `verified (${apache.signingKeyIds.join(", ")})` : "not published"}`,
      `- Candidate project version: ${newProjectVersion}`,
      `- FILES_VERSION: ${compatibility.filesVersion + 1}`,
      `- Major review required: ${majorReview ? "yes" : "no"}`,
      "",
      "The updater never commits, pushes, publishes, or imports into Oracle APEX."
    ].join("\n");
    console.log(report);
    if (options.dryRun) return { report, majorReview };

    if (majorReview) {
      if (!options.majorReview) throw new Error("A new ECharts major requires --major-review <review-file> on a dedicated branch.");
      const reviewPath = resolve(options.majorReview);
      const metadata = await lstat(reviewPath);
      if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("Major review evidence must be a regular file.");
      const branchResult = spawnSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" });
      if (branchResult.status !== 0) throw new Error(`Unable to identify the current branch: ${branchResult.stderr}`);
      const branch = branchResult.stdout.trim();
      if (!branch.includes(`echarts-${targetMajor}`)) throw new Error(`Use a dedicated branch containing echarts-${targetMajor} before applying a new major.`);
    }

    const managedStatus = spawnSync("git", [
      "status", "--porcelain", "--untracked-files=all", "--",
      "compatibility.json", "vendor/echarts", "src", "package.json", "package-lock.json",
      "CHANGELOG.md", "skills/oracle-apex-echarts/assets", "dist"
    ], { cwd: root, encoding: "utf8" });
    if (managedStatus.status !== 0) throw new Error(`Unable to inspect the managed worktree: ${managedStatus.stderr}`);
    if (managedStatus.stdout.trim()) throw new Error(`Managed files are not clean; commit or restore them before applying:\n${managedStatus.stdout.trim()}`);

    const backups = new Map();
    const oldBundle = join(root, `vendor/echarts/echarts-${compatibility.echarts}.min.js`);
    const newBundle = join(root, `vendor/echarts/echarts-${version}.min.js`);
    const created = [newBundle, join(root, `reports/upstream-update-${version}.md`)];
    const restoreGenerated = await snapshotGenerated([
      join(root, "build"),
      join(root, "dist"),
      join(root, "skills/oracle-apex-echarts/assets")
    ], temporary);
    try {
      for (const path of [compatibilityPath, oldBundle, join(root, "vendor/echarts/LICENSE"), join(root, "vendor/echarts/NOTICE"), join(root, "vendor/echarts/LICENSE-d3"), join(root, "vendor/echarts/KEYS"), join(root, "vendor/echarts/SOURCE.json"), join(root, "vendor/echarts/SHA256SUMS"), join(root, "package-lock.json")]) {
        backups.set(path, await readFile(path));
      }
      const updatedCompatibility = {
        ...compatibility,
        project: newProjectVersion,
        skill: newProjectVersion,
        plugin: newProjectVersion,
        package: newProjectVersion,
        runtime: newProjectVersion,
        echarts: version,
        filesVersion: compatibility.filesVersion + 1
      };
      await writeFile(compatibilityPath, `${JSON.stringify(updatedCompatibility, null, 2)}\n`, "utf8");
      await writeFile(newBundle, npm.files.bundle);
      await writeFile(join(root, "vendor/echarts/LICENSE"), npm.files.license);
      await writeFile(join(root, "vendor/echarts/NOTICE"), npm.files.notice);
      await writeFile(join(root, "vendor/echarts/LICENSE-d3"), npm.files.d3License);
      await writeFile(join(root, "vendor/echarts/KEYS"), apache.keys);
      const source = {
        name: "Apache ECharts",
        version,
        validationDate: new Date().toISOString().slice(0, 10),
        repository: "https://github.com/apache/echarts",
        tag: version,
        gitCommit: commit,
        sourceRelease: {
          archiveFileName: apache.archiveName,
          url: apache.archiveUrl,
          checksumUrl: apache.checksumUrl,
          sha512: apache.expectedSha512,
          status: "verified",
          signatureUrl: apache.signatureUrl,
          signaturePublished: apache.signaturePublished,
          signatureVerified: apache.signaturePublished,
          signingKeyIds: apache.signingKeyIds,
          keysUrl: apache.keysUrl
        },
        npmDistribution: {
          metadataUrl: npm.metadataUrl,
          tarballUrl: npm.metadata.dist.tarball,
          integrity: npm.metadata.dist.integrity,
          integrityVerified: true,
          bundlePath: "package/dist/echarts.min.js",
          bundleMatchedVendoredFile: true
        },
        vendoredBundle: { path: basename(newBundle), sha256: sha256(npm.files.bundle), runtimeRequired: true },
        runtimeFiles: [basename(newBundle), "LICENSE", "NOTICE", "LICENSE-d3", "SOURCE.json", "SHA256SUMS"],
        maintenanceOnlyFiles: ["KEYS"],
        license: "Apache-2.0"
      };
      await writeFile(join(root, "vendor/echarts/SOURCE.json"), `${JSON.stringify(source, null, 2)}\n`, "utf8");
      const vendorFiles = [[basename(newBundle), npm.files.bundle], ["LICENSE", npm.files.license], ["NOTICE", npm.files.notice], ["LICENSE-d3", npm.files.d3License], ["KEYS", apache.keys]];
      await writeFile(join(root, "vendor/echarts/SHA256SUMS"), `${vendorFiles.map(([name, data]) => `${sha256(data)}  ${name}`).join("\n")}\n`, "utf8");

      await updateText(join(root, "src/js/oracle-apex-echarts.js"), [
        [`root.OracleApexECharts?.version === "${compatibility.runtime}"`, `root.OracleApexECharts?.version === "${newProjectVersion}"`, "runtime duplicate guard"],
        [`const VERSION = "${compatibility.runtime}"`, `const VERSION = "${newProjectVersion}"`, "runtime version"],
        [`const ECHARTS_VERSION = "${compatibility.echarts}"`, `const ECHARTS_VERSION = "${version}"`, "ECharts runtime version"]
      ], backups);
      await updateText(join(root, "src/plsql/pk_apex_echarts.pks"), [
        [`c_package_version constant varchar2(20) := '${compatibility.package}';`, `c_package_version constant varchar2(20) := '${newProjectVersion}';`, "package version"],
        [`c_plugin_version  constant varchar2(20) := '${compatibility.plugin}';`, `c_plugin_version  constant varchar2(20) := '${newProjectVersion}';`, "plugin version"],
        [`c_runtime_version constant varchar2(20) := '${compatibility.runtime}';`, `c_runtime_version constant varchar2(20) := '${newProjectVersion}';`, "runtime version"],
        [`c_echarts_version constant varchar2(20) := '${compatibility.echarts}';`, `c_echarts_version constant varchar2(20) := '${version}';`, "ECharts version"]
      ], backups);
      await updateText(join(root, "src/plsql/pk_apex_echarts.pkb"), [[`echarts-${compatibility.echarts}.min`, `echarts-${version}.min`, "asset name"], [`echarts:${compatibility.echarts}`, `echarts:${version}`, "asset key"], [`runtime:${compatibility.runtime}`, `runtime:${newProjectVersion}`, "runtime key"]], backups);
      await updateText(join(root, "src/plugin/plugin.yaml"), [[`version: "${compatibility.plugin}"`, `version: "${newProjectVersion}"`, "plug-in version"], [`echarts-${compatibility.echarts}.min.js`, `echarts-${version}.min.js`, "plug-in asset"]], backups);
      await updateText(join(root, "src/installation/install.sql"), [
        [`c_target_version constant varchar2(20) := '${compatibility.project}';`, `c_target_version constant varchar2(20) := '${newProjectVersion}';`, "installer target version"],
        [`version_identifier = '${compatibility.plugin}'`, `version_identifier = '${newProjectVersion}'`, "installer plug-in version"],
        [`files_version = ${compatibility.filesVersion}`, `files_version = ${compatibility.filesVersion + 1}`, "installer files version"],
        [`'echarts-${compatibility.echarts}.min.js'`, `'echarts-${version}.min.js'`, "installer ECharts asset"],
        [`l_package_version <> '${compatibility.package}'`, `l_package_version <> '${newProjectVersion}'`, "installer package version"],
        [`Oracle APEX ECharts ${compatibility.project} installed successfully`, `Oracle APEX ECharts ${newProjectVersion} installed successfully`, "installer success version"]
      ], backups);
      await updateText(join(root, "src/installation/validate-installation.sql"), [
        [`l_package_version <> '${compatibility.package}'`, `l_package_version <> '${newProjectVersion}'`, "validator package version"],
        [`l_plugin_version <> '${compatibility.plugin}'`, `l_plugin_version <> '${newProjectVersion}'`, "validator plug-in version"],
        [`l_files_version <> ${compatibility.filesVersion}`, `l_files_version <> ${compatibility.filesVersion + 1}`, "validator files version"],
        [`echarts-${compatibility.echarts}.min.js`, `echarts-${version}.min.js`, "validator ECharts asset"]
      ], backups);
      await updateText(join(root, "src/installation/audit-installation.sql"), [
        [`l_plugin_version = '${compatibility.plugin}'`, `l_plugin_version = '${newProjectVersion}'`, "audit plug-in version"],
        [`l_files_version = ${compatibility.filesVersion}`, `l_files_version = ${compatibility.filesVersion + 1}`, "audit files version"],
        [`l_package_version = '${compatibility.package}'`, `l_package_version = '${newProjectVersion}'`, "audit package version"],
        [`echarts-${compatibility.echarts}.min.js`, `echarts-${version}.min.js`, "audit ECharts asset"]
      ], backups);
      await updateText(join(root, "package.json"), [[`"version": "${compatibility.project}"`, `"version": "${newProjectVersion}"`, "npm project version"]], backups);
      await updateText(join(root, "CHANGELOG.md"), [["# Changelog\n", `# Changelog\n\n## ${newProjectVersion} - unreleased\n\n- Update vendored Apache ECharts from ${compatibility.echarts} to ${version}.\n` , "changelog"]], backups);
      await rm(oldBundle);
      const lock = spawnSync("npm", ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: root, encoding: "utf8" });
      if (lock.status !== 0) throw new Error(`Unable to update package-lock.json: ${lock.stderr}`);
      await mkdir(dirname(created[1]), { recursive: true });
      await writeFile(created[1], `${report}\n`, "utf8");
      const validation = spawnSync("npm", ["run", "validate:all"], { cwd: root, encoding: "utf8", stdio: "inherit" });
      if (validation.status !== 0) throw new Error("Validation failed; update was rolled back.");
      const diff = spawnSync("git", ["diff", "--stat", "--", "compatibility.json", "vendor/echarts", "src", "package.json", "package-lock.json", "CHANGELOG.md", "skills/oracle-apex-echarts/assets", "dist"], { cwd: root, encoding: "utf8" });
      if (diff.status !== 0) throw new Error(`Unable to produce the update diff report: ${diff.stderr}`);
      await writeFile(created[1], `${report}\n\n## Repository diff\n\n\`\`\`text\n${diff.stdout.trim() || "No tracked diff."}\n\`\`\`\n`, "utf8");
      console.log(`APPLIED: candidate ${version}. Review the diff; no commit, push, release, or APEX import was performed.`);
      return { report, majorReview };
    } catch (error) {
      for (const [path, content] of backups) await writeFile(path, content);
      for (const path of created) await rm(path, { force: true });
      await restoreGenerated();
      throw error;
    }
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

function options(args) {
  const value = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
  };
  return {
    version: value("--version"),
    dryRun: args.includes("--dry-run"),
    apply: args.includes("--apply"),
    majorReview: value("--major-review")
  };
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "check") return checkUpstream();
  if (command === "update") {
    const parsed = options(args);
    if (!parsed.version) throw new Error("upstream:update requires --version X.Y.Z.");
    return updateUpstream(parsed.version, parsed);
  }
  throw new Error("Usage: upstream.mjs check | update --version X.Y.Z (--dry-run|--apply)");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}
