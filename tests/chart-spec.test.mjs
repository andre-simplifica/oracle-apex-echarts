import { beforeEach, describe, test } from "node:test";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "./expect.mjs";
import { loadRuntime } from "./load-runtime.mjs";

const runtime = loadRuntime();
const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(await readFile(resolve(here, "fixtures/valid-chart-spec.json"), "utf8"));
const testProfile = {
  project: { locale: "pt-BR", timeZone: "America/Fortaleza" },
  visual: {
    resolvedTokens: {
      palette: ["#063E36", "#DCE642"],
      background: "transparent",
      textColor: "#172033",
      fontFamily: "system-ui, sans-serif"
    }
  },
  charts: {
    preferredType: "bar",
    preferencePolicy: "prefer",
    allowedTypes: ["bar", "line", "area", "combo", "pie", "donut", "gauge", "scatter"]
  },
  behavior: {
    renderer: "canvas",
    downloadPolicy: "never",
    animation: "auto",
    labels: "auto",
    legendPosition: "bottom"
  },
  responsive: {
    breakpoints: [360, 390, 768, 1280],
    minHeight: 320,
    hideLegendBelow: 0
  },
  limits: {
    inlinePayloadWarningBytes: 256000,
    pointsWarning: 2000,
    maxPayloadBytes: 2097152,
    maxOptionDepth: 16,
    maxOptionKeys: 5000
  }
};

beforeEach(() => {
  runtime.configure({
    installationDefaults: {
      renderer: "canvas",
      minHeight: 320,
      animation: true,
      animationDuration: 500,
      download: false,
      restore: false,
      zoom: false,
      labels: "auto",
      legendPosition: "auto",
      aria: true,
      decal: false,
      inlinePayloadWarningBytes: 256000,
      pointsWarning: 2000,
      maxPayloadBytes: 2097152,
      maxOptionDepth: 16,
      maxOptionKeys: 5000
    },
    projectProfile: testProfile,
    telemetry: false
  });
});

describe("ChartSpec 1.0", () => {
  test("aceita a fixture válida e um payload vazio explícito", () => {
    expect(runtime.validateChartSpec(fixture)).toEqual([]);
    const empty = structuredClone(fixture);
    empty.data.option.series = [];
    expect(runtime.validateChartSpec(empty)).toEqual([]);
  });

  test("rejeita ID e versão incompatíveis", () => {
    const invalid = structuredClone(fixture);
    invalid.id = "1 id inseguro";
    invalid.requiredRuntime = "1.x";
    expect(runtime.validateChartSpec(invalid).join(" ")).toContain("$.id");
    expect(runtime.isRuntimeCompatible(invalid)).toBeFalse();

    const incompatibleProducer = structuredClone(fixture);
    incompatibleProducer.generatedBy = { packageVersion: "2.0.0", pluginVersion: "1.0.0" };
    expect(runtime.isRuntimeCompatible(incompatibleProducer)).toBeFalse();
  });

  test("aplica precedência sem aceitar prototype pollution", () => {
    const merged = runtime.mergeConfiguration(
      { renderer: "canvas", legend: { show: true, position: "top" } },
      { legend: { position: "bottom" } },
      { renderer: "svg" }
    );
    expect(merged).toEqual({ renderer: "svg", legend: { show: true, position: "bottom" } });
    expect(() => runtime.mergeConfiguration(JSON.parse('{"__proto__":{"polluted":true}}'))).toThrow();
  });

  test("compila configuração segura, ARIA e formatter registrado", () => {
    runtime.configure({
      projectProfile: {
        visual: {
          resolvedTokens: { palette: ["#063e36", "#dce642"], background: "transparent" }
        },
        behavior: { renderer: "canvas", downloadPolicy: "never" }
      }
    });
    const option = runtime.compileOption(fixture);
    expect(option.aria.enabled).toBeTrue();
    expect(option.aria.label.description).toBe(fixture.accessibility.description);
    expect(option.tooltip.renderMode).toBe("richText");
    expect(typeof option.tooltip.valueFormatter).toBe("function");
    expect(option.toolbox.feature.dataView).toBeUndefined();
    expect(option.media.some((entry) => entry.query?.maxWidth === 389)).toBeTrue();
  });

  test("expõe alternância nativa de tipo somente pela allowlist", () => {
    const interactive = structuredClone(fixture);
    interactive.behavior.magicType = ["line", "bar"];
    expect(runtime.validateChartSpec(interactive)).toEqual([]);
    const option = runtime.compileOption(interactive);
    expect(option.toolbox.feature.magicType.type).toEqual(["line", "bar"]);
    expect(option.toolbox.feature.magicType.title.line).toBe("Exibir como linha");
    expect(option.toolbox.right).toBe(8);
    expect(option.toolbox.top).toBe(8);
    expect(option.toolbox.itemSize).toBe(18);
    expect(option.toolbox.feature.dataView).toBeUndefined();
  });

  test("preserva defaults do core quando o ChartSpec omite opções", () => {
    const minimal = structuredClone(fixture);
    delete minimal.renderer;
    delete minimal.size;
    delete minimal.behavior;
    const option = runtime.compileOption(minimal);
    expect(option.animation).toBeTrue();
    expect(option.aria.enabled).toBeTrue();
    expect(option.toolbox.show).toBeFalse();
  });

  test("revalida a configuração efetiva depois da precedência", () => {
    const withoutRegionHeight = structuredClone(fixture);
    delete withoutRegionHeight.size;
    runtime.configure({ projectProfile: { responsive: { minHeight: "320" } } });
    expect(() => runtime.compileOption(withoutRegionHeight)).toThrow("Configuração efetiva");
    runtime.configure({ projectProfile: { responsive: { minHeight: 320 } } });
    expect(() => runtime.compileOption(withoutRegionHeight)).not.toThrow();
  });

  test("accepts multiple allowlisted series", () => {
    const multiple = structuredClone(fixture);
    multiple.preset = "advanced";
    multiple.data.option = {
      xAxis: { type: "category" },
      yAxis: { type: "value" },
      series: [
        { type: "bar", data: [["A", 10]] },
        { type: "line", data: [["A", 20]] },
        { type: "scatter", data: [[10, 20]] }
      ]
    };
    expect(runtime.validateChartSpec(multiple)).toEqual([]);
    const option = runtime.compileOption(multiple);
    expect(option.series.map((series) => series.type)).toEqual(["bar", "line", "scatter"]);
    expect(option.media.some((entry) => entry.query?.maxWidth === 767)).toBeTrue();
  });

  test("mantém payload grande como warning operacional, não erro de contrato", () => {
    const large = structuredClone(fixture);
    large.data.option.series[0].data = Array.from({ length: 2100 }, (_, index) => index);
    expect(runtime.validateChartSpec(large)).toEqual([]);
  });
});
