import { describe, test } from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "./expect.mjs";
import { loadRuntime } from "./load-runtime.mjs";

const runtime = loadRuntime();
const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(await readFile(resolve(here, "fixtures/valid-chart-spec.json"), "utf8"));

describe("política de segurança", () => {
  test("escapa fechamento de script e caracteres HTML", () => {
    const serialized = runtime.escapeScriptJson({ text: "</script><img src=x>" });
    expect(serialized).not.toContain("</script>");
    expect(serialized).toContain("\\u003c/script\\u003e");
  });

  test("sanitiza nomes de download", () => {
    expect(runtime.sanitizeFileName("Produção mensal / 2026")).toBe("Producao-mensal-2026");
    expect(runtime.sanitizeFileName("../../")).toBe("grafico");
  });

  test("bloqueia URL e esquema não autorizado", () => {
    const invalid = structuredClone(fixture);
    invalid.data.option.title = { text: "https://example.invalid" };
    expect(runtime.validateChartSpec(invalid).join(" ")).toContain("URL ou esquema não autorizado");

    invalid.data.option.title.text = "  javascript:alert(1)";
    expect(runtime.validateChartSpec(invalid).join(" ")).toContain("URL ou esquema não autorizado");
  });

  test("bloqueia formatter arbitrário e função no OPTION_JSON", () => {
    const invalidFormatter = structuredClone(fixture);
    invalidFormatter.behavior.formatter = "codigo_livre";
    expect(runtime.validateChartSpec(invalidFormatter).join(" ")).toContain("formatter");

    const invalidFunction = structuredClone(fixture);
    invalidFunction.data.option.tooltip = { formatter() { return "x"; } };
    expect(runtime.validateChartSpec(invalidFunction).join(" ")).toContain("formatter");
  });

  test("bloqueia dataView, renderItem e propriedades fora da allowlist", () => {
    const invalid = structuredClone(fixture);
    invalid.data.option.toolbox = { feature: { dataView: { show: true } } };
    expect(runtime.validateChartSpec(invalid).join(" ")).toContain("dataView");

    invalid.data.option = { series: [{ type: "line", renderItem: "x", data: [] }] };
    expect(runtime.validateChartSpec(invalid).join(" ")).toContain("renderItem");

    invalid.data.option = { series: [{ type: "custom", data: [] }] };
    expect(runtime.validateChartSpec(invalid).join(" ")).toContain("Tipo de série");
  });

  test("bloqueia tipos mágicos arbitrários e repetidos", () => {
    const arbitrary = structuredClone(fixture);
    arbitrary.behavior.magicType = ["line", "custom"];
    expect(runtime.validateChartSpec(arbitrary).join(" ")).toContain("magicType");

    const repeated = structuredClone(fixture);
    repeated.behavior.magicType = ["bar", "bar"];
    expect(runtime.validateChartSpec(repeated).join(" ")).toContain("magicType");
  });
});
