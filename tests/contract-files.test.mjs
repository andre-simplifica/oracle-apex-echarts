import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const matrix = JSON.parse(await readFile(join(root, "compatibility.json"), "utf8"));
const temporary = await mkdtemp(join(tmpdir(), "oae-contract-test-"));
const pluginA = join(temporary, "plugin-a.sql");
const pluginB = join(temporary, "plugin-b.sql");

async function text(path) {
  return readFile(join(root, path), "utf8");
}

function buildPlugin(output) {
  const result = spawnSync(process.execPath, [join(root, "scripts/build-plugin.mjs"), "--output", output], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
}

after(async () => rm(temporary, { recursive: true, force: true }));

describe("repository contracts", () => {
  test("keeps the stable plug-in name, neutral display name, and 25 declarative attributes", async () => {
    const manifest = parseYaml(await text("src/plugin/plugin.yaml"));
    assert.equal(manifest.plugin.internal_name, "COM.SIMPLIFICA.APEX.ECHARTS");
    assert.equal(manifest.plugin.display_name, "Apache ECharts for Oracle APEX");
    assert.equal(manifest.component_attributes.length, 25);
    assert.deepEqual(manifest.component_attributes.map((attribute) => attribute.sequence), Array.from({ length: 25 }, (_, index) => index + 1));
    assert.ok(!manifest.plugin.standard_attributes.includes("INIT_JAVASCRIPT_CODE"));
    assert.equal(manifest.component_attributes[3].default, "BAR_VERTICAL");
  });

  test("keeps the package API complete and free of business DML or outbound HTTP", async () => {
    const specification = (await text("src/plsql/pk_apex_echarts.pks")).toLowerCase();
    const body = await text("src/plsql/pk_apex_echarts.pkb");
    for (const name of ["func_validate_chart_spec", "proc_assert_chart_spec", "func_chart", "func_chart_inline", "func_chart_ajax", "func_ajax_result", "func_plugin_render", "func_plugin_ajax"]) {
      assert.ok(specification.includes(name));
      assert.ok(body.toLowerCase().includes(name));
    }
    assert.match(body.toLowerCase(), /sys\.dbms_json_schema\.is_valid/);
    assert.match(body.toLowerCase(), /apex_exec\.close/);
    assert.match(body.toLowerCase(), /apex_javascript\.add_library/);
    assert.match(body.toLowerCase(), /func_project_message/);
    assert.match(body.toLowerCase(), /func_plugin_overrides\(p_region, p_plugin\)/);
    assert.doesNotMatch(body, /\butl_http\b/i);
    assert.doesNotMatch(body, /^\s*(insert\s+into|update\s+\S+|delete\s+from|merge\s+into|commit\s*;|rollback\s*;)/im);
    assert.doesNotMatch(body, /\bexecute\s+immediate\b/i);
  });

  test("deduplicates shared assets for multiple charts and mixed pages", async () => {
    const body = await text("src/plsql/pk_apex_echarts.pkb");
    const keys = [...body.matchAll(/p_key\s*=>\s*'([^']+)'/g)].map((match) => match[1]);
    assert.deepEqual(keys, [
      `com.simplifica.apex.echarts:echarts:${matrix.echarts}`,
      `com.simplifica.apex.echarts:runtime:${matrix.runtime}`
    ]);
    assert.equal(new Set(keys).size, keys.length);
    assert.match(body, /window\.OracleApexECharts\.bootstrap\(\)/);
    assert.match(await text("examples/mixed/page-designer.md"), /one shared registry/i);
  });

  test("keeps external and embedded ChartSpec schemas aligned", async () => {
    const schema = JSON.parse(await text("schemas/chart-spec.schema.json"));
    const body = await text("src/plsql/pk_apex_echarts.pkb");
    assert.equal(schema.properties.schemaVersion.const, "1.0");
    const runtimeMajor = Number(matrix.runtime.split(".")[0]);
    const requiredRuntime = `>=${runtimeMajor}.0.0 <${runtimeMajor + 1}.0.0`;
    assert.equal(schema.properties.requiredRuntime.const, requiredRuntime);
    assert.match(body, /"schemaVersion":\{"const":"1\.0"\}/);
    assert.ok(body.includes(`"requiredRuntime":{"const":"${requiredRuntime}"}`));
    assert.match(body, /'bar,line,pie,gauge,scatter'/);
    assert.doesNotMatch(body, /renderItem,dataView|heatmap,treemap,sankey/);
  });

  test("generates a deterministic, integral plug-in export with embedded offline files", async () => {
    buildPlugin(pluginA);
    buildPlugin(pluginB);
    const first = await readFile(pluginA);
    const second = await readFile(pluginB);
    assert.equal(createHash("sha256").update(first).digest("hex"), createHash("sha256").update(second).digest("hex"));
    const plugin = first.toString("utf8");
    assert.match(plugin, /p_name=>'COM\.SIMPLIFICA\.APEX\.ECHARTS'/);
    assert.match(plugin, /p_display_name=>'Apache ECharts for Oracle APEX'/);
    assert.match(plugin, new RegExp(`p_version_identifier=>'${matrix.plugin.replaceAll(".", "\\.")}'`));
    assert.match(plugin, new RegExp(`p_files_version=>${matrix.filesVersion}`));
    assert.equal((plugin.match(/p_attribute_scope=>'COMPONENT'/g) ?? []).length, 25);
    for (const file of [`echarts-${matrix.echarts}.min.js`, "oracle-apex-echarts.js", "oracle-apex-echarts.css", "LICENSE", "NOTICE", "LICENSE-d3", "SOURCE.json", "SHA256SUMS"]) {
      assert.equal((plugin.match(new RegExp(`p_file_name=>'${file.replaceAll(".", "\\.")}'`, "g")) ?? []).length, 1);
    }
    const checksumFile = plugin.indexOf("p_file_name=>'SHA256SUMS'");
    const checksumTable = plugin.lastIndexOf("wwv_flow_imp.g_varchar2_table :=", checksumFile);
    const checksumHex = [...plugin.slice(checksumTable, checksumFile).matchAll(/g_varchar2_table\(\d+\) := '([0-9A-F]+)'/g)]
      .map((match) => match[1])
      .join("");
    const embeddedChecksums = Buffer.from(checksumHex, "hex").toString("utf8");
    assert.doesNotMatch(embeddedChecksums, /  KEYS$/m);
    for (const file of [`echarts-${matrix.echarts}.min.js`, "oracle-apex-echarts.js", "oracle-apex-echarts.css", "LICENSE", "NOTICE", "LICENSE-d3", "SOURCE.json"]) {
      assert.match(embeddedChecksums, new RegExp(`[0-9a-f]{64}  ${file.replaceAll(".", "\\.")}`));
    }
    assert.match(plugin, /wwv_flow_imp\.component_end/);
    assert.doesNotMatch(plugin, /https?:\/\/(?:cdn|unpkg|jsdelivr)/i);
  });

  test("verifies vendored bytes, npm provenance, licenses, and explicit Apache mismatch rejection", async () => {
    const vendor = join(root, "vendor/echarts");
    const source = JSON.parse(await readFile(join(vendor, "SOURCE.json"), "utf8"));
    const rows = (await readFile(join(vendor, "SHA256SUMS"), "utf8")).trim().split("\n");
    for (const row of rows) {
      const [expected, name] = row.split(/\s{2,}/);
      const actual = createHash("sha256").update(await readFile(join(vendor, name))).digest("hex");
      assert.equal(actual, expected, name);
    }
    assert.equal(source.version, matrix.echarts);
    if (source.sourceRelease.status === "rejected-name-mismatch") {
      assert.equal(source.sourceRelease.acceptedAsBundleSource, false);
    } else {
      assert.equal(source.sourceRelease.status, "verified");
      assert.equal(source.sourceRelease.signaturePublished, source.sourceRelease.signatureVerified);
    }
    assert.equal(source.npmDistribution.integrityVerified, true);
    assert.equal(source.npmDistribution.bundleMatchedVendoredFile, true);
    const bundle = await readFile(join(vendor, `echarts-${matrix.echarts}.min.js`));
    assert.equal(source.vendoredBundle.sha256, createHash("sha256").update(bundle).digest("hex"));
  });

  test("ships fail-safe installer and post-installation validation without page creation", async () => {
    const installer = await text("src/installation/install.sql");
    const validator = await text("src/installation/validate-installation.sql");
    assert.match(installer, /define TARGET_APP_ID = '&1'/);
    assert.match(installer, /apex_application_install\.set_workspace_id/);
    assert.match(installer, /@@packages\/pk_apex_echarts\.pks/);
    assert.match(installer, /@@plugin\.sql/);
    assert.match(installer, /USER_ERRORS/i);
    assert.match(installer, /apex_appl_plugin_files/i);
    assert.match(installer, /Downgrade blocked/);
    assert.match(installer, /select workspace_id, workspace, owner\s+into/i);
    assert.doesNotMatch(installer, /select workspace_id, workspace, parsing_schema/i);
    assert.match(installer, /exit success/);
    assert.match(validator, /exit success/);
    assert.doesNotMatch(installer, /create_page|create_region|apex export|accept\s|pause\s/i);
    const audit = await text("src/installation/audit-installation.sql");
    assert.match(audit, /APEX_APPL_PLUGINS/i);
    assert.match(audit, /USER_SOURCE/i);
    assert.match(audit, /ABSENT/);
    assert.match(audit, /INCOMPATIBLE_OR_PARTIAL/);
    assert.match(audit, /echarts-6\.1\.0\.min\.js/);
    assert.match(audit, /l_expected_file_count = 8/);
    assert.match(audit, /select count\(\*\), max\(workspace\), max\(owner\)/i);
    assert.doesNotMatch(audit, /max\(parsing_schema\)/i);
    assert.doesNotMatch(audit, /execute\s+immediate|create\s+|alter\s+|drop\s+|insert\s+|update\s+|delete\s+|merge\s+|commit\s*;/i);
  });

  test("keeps the linked-skill APEX distribution executable and checksummed", async () => {
    const distribution = join(root, "skills/oracle-apex-echarts/assets/apex-distribution");
    for (const path of [
      "plugin.sql",
      "packages/pk_apex_echarts.pks",
      "packages/pk_apex_echarts.pkb",
      "install.sql",
      "audit-installation.sql",
      "validate-installation.sql",
      "compatibility.json",
      "schemas/compatibility.schema.json",
      "docs/installation/rollback.md"
    ]) await readFile(join(distribution, path));
    const compatibility = JSON.parse(await readFile(join(distribution, "compatibility.json"), "utf8"));
    await readFile(join(distribution, compatibility.$schema));
    const rows = (await readFile(join(distribution, "SHA256SUMS"), "utf8")).trim().split("\n");
    for (const row of rows) {
      const [expected, name] = row.split(/\s{2,}/);
      const actual = createHash("sha256").update(await readFile(join(distribution, name))).digest("hex");
      assert.equal(actual, expected, name);
    }
  });

  test("ships every requested synthetic chart and integration example", async () => {
    for (const type of ["bar", "line", "area", "combo", "pie", "donut", "gauge", "scatter"]) {
      const spec = JSON.parse(await text(`examples/chart-types/${type}.json`));
      assert.equal(spec.schemaVersion, "1.0");
      assert.equal(spec.data.mode, "inline");
    }
    assert.match(await text("examples/plugin-region/normalized-sql.sql"), /x_value[\s\S]*y_value[\s\S]*series_name/i);
    assert.match(await text("examples/plugin-region/option-json.sql"), /option_json/i);
    assert.match(await text("examples/dynamic-content/region-source.sql"), /return pk_oae_synthetic_demo\.func_dashboard/);
    assert.match(await text("examples/mixed/page-designer.md"), /RUNTIME_ONLY/);
    assert.equal(JSON.parse(await text("examples/states/no-data.json")).data.option.series.length, 0);
    assert.match(await text("examples/states/safe-error.sql"), /renderItem/);
    const css = await text("src/css/oracle-apex-echarts.css");
    assert.match(css, /@media \(max-width: 767px\)/);
    assert.match(css, /@media \(max-width: 389px\)/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  });

  test("records separate component versions and no live runtime claims", async () => {
    const compatibility = JSON.parse(await text("compatibility.json"));
    for (const key of ["project", "skill", "plugin", "package", "runtime", "echarts"]) assert.match(compatibility[key], /^\d+\.\d+\.\d+$/);
    assert.match(compatibility.chartSpec, /^\d+\.\d+$/);
    assert.match(compatibility.profile, /^\d+\.\d+$/);
    assert.deepEqual(compatibility.oracleApex.runtimeValidated, []);
    assert.deepEqual(compatibility.browsers.runtimeValidated, []);
  });

  test("tracks the current release tag in the scaffold and the bug template", async () => {
    const compatibility = JSON.parse(await text("compatibility.json"));
    const scaffold = await text("skills/oracle-apex-echarts/scripts/scaffold_consumer.py");
    assert.match(scaffold, new RegExp(`"--ref", default="v${compatibility.project.replaceAll(".", "\\.")}"`));
    const bugTemplate = await text(".github/ISSUE_TEMPLATE/bug.yml");
    assert.match(bugTemplate, new RegExp(`Oracle APEX ECharts ${compatibility.project.replaceAll(".", "\\.")},`));
    assert.ok(await text(`docs/releases/${compatibility.project}.md`));
  });
});
