import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileProjectProfile, stableJson } from "./profile.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const buildDir = join(root, "build");
const compatibility = JSON.parse(await readFile(join(root, "compatibility.json"), "utf8"));
const echartsVersion = compatibility.echarts;
const pluginVersion = compatibility.plugin;
const filesVersion = compatibility.filesVersion;

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const output = resolve(option("--output") ?? join(buildDir, "plugin.sql"));
const profilePath = option("--profile");
const defaultWorkspaceId = option("--workspace-id") ?? "0";
const defaultApplicationId = option("--application-id") ?? "0";
const defaultIdOffset = option("--id-offset") ?? "0";
const defaultOwner = option("--owner") ?? "APP_SCHEMA";

const pluginId = 910000000000000001n;
let nextId = 910000000000000100n;

const sql = (value) => `'${String(value).replaceAll("'", "''")}'`;
const id = () => `wwv_flow_imp.id(${nextId++})`;
const lines = (value) => {
  const parts = String(value).replaceAll("\r\n", "\n").split("\n");
  return `wwv_flow_string.join(wwv_flow_t_varchar2(\n${parts.map((part) => `  ${sql(part)}`).join(",\n")}\n))`;
};

const attributes = [
  { scope: "APPLICATION", seq: 1, label: "Installation Defaults JSON", type: "TEXT", defaultValue: "{}" },
  { scope: "APPLICATION", seq: 2, label: "Project Profile JSON", type: "TEXT", profile: true },
  { scope: "APPLICATION", seq: 3, label: "Development Telemetry", type: "SELECT LIST", defaultValue: "N", values: [["Disabled", "N"], ["Enabled", "Y"]] },
  { scope: "COMPONENT", seq: 1, label: "Mode", type: "SELECT LIST", defaultValue: "CHART", values: [["Chart", "CHART"], ["Runtime only", "RUNTIME_ONLY"]] },
  { scope: "COMPONENT", seq: 2, label: "Data Contract", type: "SELECT LIST", defaultValue: "NORMALIZED_SQL", values: [["Normalized SQL", "NORMALIZED_SQL"], ["Option JSON", "OPTION_JSON"]] },
  { scope: "COMPONENT", seq: 3, label: "Load Mode", type: "SELECT LIST", defaultValue: "INLINE", values: [["Inline", "INLINE"], ["AJAX", "AJAX"]] },
  { scope: "COMPONENT", seq: 4, label: "Preset", type: "SELECT LIST", defaultValue: "BAR_VERTICAL", values: [
    ["Vertical bar", "BAR_VERTICAL"], ["Horizontal bar", "BAR_HORIZONTAL"], ["Stacked bar", "BAR_STACKED"],
    ["Line", "LINE"], ["Area", "AREA"], ["Bar and line", "BAR_LINE"], ["Pie", "PIE"], ["Donut", "DONUT"],
    ["Gauge", "GAUGE"], ["Scatter", "SCATTER"], ["Advanced", "ADVANCED"]
  ] },
  { scope: "COMPONENT", seq: 5, label: "Theme", type: "TEXT" },
  { scope: "COMPONENT", seq: 6, label: "Renderer", type: "SELECT LIST", defaultValue: "CANVAS", values: [["Canvas", "CANVAS"], ["SVG", "SVG"]] },
  { scope: "COMPONENT", seq: 7, label: "Minimum Height", type: "NUMBER", defaultValue: "320" },
  { scope: "COMPONENT", seq: 8, label: "Animation", type: "CHECKBOX", defaultValue: "Y" },
  { scope: "COMPONENT", seq: 9, label: "Animation Duration", type: "NUMBER", defaultValue: "500" },
  { scope: "COMPONENT", seq: 10, label: "Legend", type: "SELECT LIST", defaultValue: "SHOW", values: [["Show", "SHOW"], ["Hide", "HIDE"]] },
  { scope: "COMPONENT", seq: 11, label: "Legend Position", type: "SELECT LIST", defaultValue: "AUTO", values: [["Auto", "AUTO"], ["Top", "TOP"], ["Bottom", "BOTTOM"], ["Left", "LEFT"], ["Right", "RIGHT"]] },
  { scope: "COMPONENT", seq: 12, label: "Labels", type: "SELECT LIST", defaultValue: "AUTO", values: [["Auto", "AUTO"], ["Show", "SHOW"], ["Hide", "HIDE"]] },
  { scope: "COMPONENT", seq: 13, label: "Tooltip", type: "CHECKBOX", defaultValue: "Y" },
  { scope: "COMPONENT", seq: 14, label: "Zoom", type: "CHECKBOX", defaultValue: "N" },
  { scope: "COMPONENT", seq: 15, label: "Save as Image", type: "CHECKBOX", defaultValue: "N" },
  { scope: "COMPONENT", seq: 16, label: "Restore", type: "CHECKBOX", defaultValue: "N" },
  { scope: "COMPONENT", seq: 17, label: "Download File Name", type: "TEXT" },
  { scope: "COMPONENT", seq: 18, label: "ARIA", type: "CHECKBOX", defaultValue: "Y" },
  { scope: "COMPONENT", seq: 19, label: "Accessible Description", type: "TEXT", required: true },
  { scope: "COMPONENT", seq: 20, label: "Decal", type: "CHECKBOX", defaultValue: "N" },
  { scope: "COMPONENT", seq: 21, label: "Named Formatter", type: "SELECT LIST", values: [
    ["Integer", "INTEGER"], ["Decimal (2)", "DECIMAL_2"], ["Percent", "PERCENT"], ["BRL currency", "CURRENCY_BRL"],
    ["Short number", "SHORT_NUMBER"], ["Date (pt-BR)", "DATE_BR"], ["Date and time (pt-BR)", "DATETIME_BR"]
  ] },
  { scope: "COMPONENT", seq: 22, label: "Refresh Strategy", type: "SELECT LIST", defaultValue: "REPLACE", values: [["Replace", "REPLACE"], ["Merge", "MERGE"]] },
  { scope: "COMPONENT", seq: 23, label: "Empty Message", type: "TEXT" },
  { scope: "COMPONENT", seq: 24, label: "Error Message", type: "TEXT" },
  { scope: "COMPONENT", seq: 25, label: "ChartSpec Overrides JSON", type: "TEXT" }
];

const embeddedSources = [
  [`echarts-${echartsVersion}.min.js`, join(root, `vendor/echarts/echarts-${echartsVersion}.min.js`), "application/javascript"],
  ["oracle-apex-echarts.js", join(root, "src/js/oracle-apex-echarts.js"), "application/javascript"],
  ["oracle-apex-echarts.css", join(root, "src/css/oracle-apex-echarts.css"), "text/css"],
  ["LICENSE", join(root, "vendor/echarts/LICENSE"), "text/plain"],
  ["NOTICE", join(root, "vendor/echarts/NOTICE"), "text/plain"],
  ["LICENSE-d3", join(root, "vendor/echarts/LICENSE-d3"), "text/plain"],
  ["SOURCE.json", join(root, "vendor/echarts/SOURCE.json"), "application/json"]
];
const files = await Promise.all(embeddedSources.map(async ([fileName, path, mimeType]) => [fileName, await readFile(path), mimeType]));
const embeddedChecksums = `${files.map(([fileName, content]) => `${createHash("sha256").update(content).digest("hex")}  ${fileName}`).join("\n")}\n`;
files.push(["SHA256SUMS", Buffer.from(embeddedChecksums, "utf8"), "text/plain"]);

const profile = profilePath
  ? (await readFile(resolve(profilePath), "utf8")).trim()
  : stableJson((await compileProjectProfile(join(root, "profiles/neutral.yaml"), { projectRoot: root })).profile).trim();
const out = [];
out.push("prompt --application/shared_components/plugins/region_type/com_simplifica_apex_echarts");
out.push("begin");
out.push("wwv_flow_imp.component_begin (");
out.push(" p_version_yyyy_mm_dd=>'2024.11.30'");
out.push(",p_release=>'24.2.10'");
out.push(`,p_default_workspace_id=>${defaultWorkspaceId}`);
out.push(`,p_default_application_id=>${defaultApplicationId}`);
out.push(`,p_default_id_offset=>${defaultIdOffset}`);
out.push(`,p_default_owner=>${sql(defaultOwner)}`);
out.push(");");
out.push("wwv_flow_imp_shared.create_plugin(");
out.push(` p_id=>wwv_flow_imp.id(${pluginId})`);
out.push(",p_plugin_type=>'REGION TYPE'");
out.push(",p_name=>'COM.SIMPLIFICA.APEX.ECHARTS'");
out.push(",p_display_name=>'Apache ECharts for Oracle APEX'");
out.push(",p_image_prefix => nvl(wwv_flow_application_install.get_static_plugin_file_prefix('REGION TYPE','COM.SIMPLIFICA.APEX.ECHARTS'),'')");
out.push(`,p_plsql_code=>${lines(`function render(
  p_region              in apex_plugin.t_region,
  p_plugin              in apex_plugin.t_plugin,
  p_is_printer_friendly in boolean
) return apex_plugin.t_region_render_result
is
begin
  return pk_apex_echarts.func_plugin_render(p_region, p_plugin, p_is_printer_friendly);
end render;

function ajax(
  p_region in apex_plugin.t_region,
  p_plugin in apex_plugin.t_plugin
) return apex_plugin.t_region_ajax_result
is
begin
  return pk_apex_echarts.func_plugin_ajax(p_region, p_plugin);
end ajax;`)}`);
out.push(",p_api_version=>1");
out.push(",p_render_function=>'render'");
out.push(",p_ajax_function=>'ajax'");
out.push(",p_standard_attributes=>'SOURCE_SQL:AJAX_ITEMS_TO_SUBMIT:NO_DATA_FOUND_MESSAGE'");
out.push(",p_substitute_attributes=>true");
out.push(`,p_version_scn=>${filesVersion}`);
out.push(",p_subscribe_plugin_settings=>true");
out.push(",p_help_text=>'Shared, secure Apache ECharts runtime for plug-in regions and Dynamic Content.'");
out.push(`,p_version_identifier=>${sql(pluginVersion)}`);
out.push(",p_about_url=>'https://echarts.apache.org/'");
out.push(`,p_files_version=>${filesVersion}`);
out.push(");");

const attributeIds = new Map();
for (const attribute of attributes) {
  const attributeId = id();
  attributeIds.set(`${attribute.scope}:${attribute.seq}`, attributeId);
  out.push("wwv_flow_imp_shared.create_plugin_attribute(");
  out.push(` p_id=>${attributeId}`);
  out.push(`,p_plugin_id=>wwv_flow_imp.id(${pluginId})`);
  out.push(`,p_attribute_scope=>${sql(attribute.scope)}`);
  out.push(`,p_attribute_sequence=>${attribute.seq}`);
  out.push(`,p_display_sequence=>${attribute.seq * 10}`);
  out.push(`,p_static_id=>${sql(`attribute_${String(attribute.seq).padStart(2, "0")}`)}`);
  out.push(`,p_prompt=>${sql(attribute.label)}`);
  out.push(`,p_attribute_type=>${sql(attribute.type)}`);
  out.push(`,p_is_required=>${attribute.required ? "true" : "false"}`);
  if (attribute.profile) out.push(`,p_default_value=>${sql(profile)}`);
  else if (attribute.defaultValue != null) out.push(`,p_default_value=>${sql(attribute.defaultValue)}`);
  out.push(",p_is_translatable=>false");
  if (attribute.values) out.push(",p_lov_type=>'STATIC'");
  out.push(");");

  for (const [index, [display, value]] of (attribute.values ?? []).entries()) {
    out.push("wwv_flow_imp_shared.create_plugin_attr_value(");
    out.push(` p_id=>${id()}`);
    out.push(`,p_plugin_attribute_id=>${attributeId}`);
    out.push(`,p_display_sequence=>${(index + 1) * 10}`);
    out.push(`,p_display_value=>${sql(display)}`);
    out.push(`,p_return_value=>${sql(value)}`);
    out.push(");");
  }
}
out.push("wwv_flow_imp_shared.create_plugin_std_attribute(");
out.push(` p_id=>${id()}`);
out.push(`,p_plugin_id=>wwv_flow_imp.id(${pluginId})`);
out.push(",p_name=>'SOURCE_SQL'");
out.push(`,p_default_value=>${lines(`select 'T1' x_value,
       10 y_value,
       'Série A' series_name,
       'bar' series_type,
       'T1' item_label,
       null item_color,
       1 sort_order
  from dual`)}`);
out.push(",p_sql_min_column_count=>3");
out.push(",p_depending_on_has_to_exist=>true");
out.push(",p_help_text=>'SQL seguro com as colunas obrigatórias X_VALUE, Y_VALUE e SERIES_NAME. SERIES_TYPE, ITEM_LABEL, ITEM_COLOR e SORT_ORDER são opcionais.'");
out.push(");");
out.push("end;");
out.push("/");

for (const [fileName, content, mimeType] of files) {
  const hex = content.toString("hex").toUpperCase();
  const chunks = hex.match(/.{1,200}/g) ?? [];
  const chunksPerBlock = 25;
  for (let offset = 0; offset < chunks.length; offset += chunksPerBlock) {
    out.push("begin");
    if (offset === 0) {
      out.push("wwv_flow_imp.g_varchar2_table := wwv_flow_imp.empty_varchar2_table;");
    }
    chunks.slice(offset, offset + chunksPerBlock).forEach((chunk, index) => {
      out.push(`wwv_flow_imp.g_varchar2_table(${offset + index + 1}) := '${chunk}';`);
    });
    out.push("end;");
    out.push("/");
  }
  out.push("begin");
  out.push("wwv_flow_imp_shared.create_plugin_file(");
  out.push(` p_id=>${id()}`);
  out.push(`,p_plugin_id=>wwv_flow_imp.id(${pluginId})`);
  out.push(`,p_file_name=>${sql(fileName)}`);
  out.push(`,p_mime_type=>${sql(mimeType)}`);
  out.push(",p_file_charset=>'utf-8'");
  out.push(",p_file_content=>wwv_flow_imp.varchar2_to_blob(wwv_flow_imp.g_varchar2_table)");
  out.push(");");
  out.push("end;");
  out.push("/");
}

out.push("begin");
out.push("wwv_flow_imp.component_end;");
out.push("end;");
out.push("/");

await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${out.join("\n")}\n`, "utf8");
console.log(`Plug-in gerado: ${output}`);
console.log(`Profile default: ${profilePath ? resolve(profilePath) : "compiled neutral profile"}`);
console.log(`Atributos: ${attributes.filter((item) => item.scope === "COMPONENT").length} component + ${attributes.filter((item) => item.scope === "APPLICATION").length} application`);
console.log(`Arquivos incorporados: ${files.length}`);
