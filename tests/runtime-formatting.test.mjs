import { describe, test } from "node:test";
import { expect } from "./expect.mjs";
import { loadRuntime } from "./load-runtime.mjs";

// Synthetic options only. Each runtime gets its own context, so the page
// language and profile of one test never leak into another.
function runtimeFor(lang, profile, globals = {}) {
  const runtime = loadRuntime({ ...(lang === undefined ? {} : { document: { documentElement: { lang } } }), ...globals });
  if (profile) runtime.configure({ projectProfile: profile });
  return runtime;
}

// Records the locale passed to Intl.NumberFormat, so the en-US fallback cannot
// pass by accident on a machine whose default locale is already en-US.
function recordingIntl(locales) {
  function NumberFormat(locale, options) {
    locales.push(locale);
    return new Intl.NumberFormat(locale, options);
  }
  NumberFormat.supportedLocalesOf = (tags) => Intl.NumberFormat.supportedLocalesOf(tags);
  return { ...Object.fromEntries(Object.getOwnPropertyNames(Intl).map((name) => [name, Intl[name]])), NumberFormat };
}

function spec(option, extra = {}) {
  return {
    schemaVersion: "1.0",
    id: "synthetic_formatting",
    requiredRuntime: ">=1.0.0 <2.0.0",
    accessibility: { description: "Synthetic chart.", fallbackText: "Synthetic values table." },
    data: { mode: "inline", contract: "option", option },
    ...extra
  };
}

function columns() {
  return {
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: ["A", "B"] },
    yAxis: { type: "value" },
    series: [{ name: "Values", type: "bar", data: [1299, 376] }]
  };
}

function ranking() {
  return {
    xAxis: { type: "value" },
    yAxis: { type: "category", data: ["A", "B"] },
    series: [{ type: "bar", label: { show: true, position: "right" }, data: [1299, { value: 7 }] }]
  };
}

describe("locale-aware numbers", () => {
  test("uses the page language when the profile has no locale", () => {
    const option = runtimeFor("pt-br").compileOption(spec(columns()));
    expect(option.yAxis.axisLabel.formatter(1200)).toBe("1.200");
    expect(option.tooltip.valueFormatter(1299)).toBe("1.299");
    expect(option.series[0].label.formatter({ value: 1299 })).toBe("1.299");
    expect(option.xAxis.axisLabel).toBeUndefined();
  });

  test("keeps the decimals of each value", () => {
    const option = runtimeFor("pt-br").compileOption(spec(columns()));
    expect([0.25, 2.5, 1234567.891, 1.5e-7].map((value) => option.yAxis.axisLabel.formatter(value)))
      .toEqual(["0,25", "2,5", "1.234.567,891", "0,00000015"]);
  });

  test("formats log axes and keeps gaps in numeric series", () => {
    const option = runtimeFor("pt-br").compileOption(spec({
      xAxis: { type: "category", data: ["A", "B", "C"] },
      yAxis: { type: "log" },
      series: [{ type: "line", label: { show: true }, data: [1299, null, "-"] }]
    }));
    expect(option.yAxis.axisLabel.formatter(10000)).toBe("10.000");
    expect(option.series[0].label.formatter({ value: 1299 })).toBe("1.299");
  });

  test("lets the profile locale win over the page language", () => {
    const option = runtimeFor("pt-br", { project: { locale: "en-US" } }).compileOption(spec(columns()));
    expect(option.yAxis.axisLabel.formatter(1200)).toBe("1,200");
  });

  test("falls back to the page language when the profile locale is invalid", () => {
    const option = runtimeFor("pt-br", { project: { locale: "pt_BR" } }).compileOption(spec(columns()));
    expect(option.yAxis.axisLabel.formatter(1200)).toBe("1.200");
    const registered = runtimeFor("en-us", { project: { locale: "pt_BR" } })
      .compileOption(spec(columns(), { behavior: { formatter: "integer" } }));
    expect(registered.tooltip.valueFormatter(1299.4)).toBe("1,299");
  });

  test("uses en-US without a valid page language or profile locale", () => {
    const locales = [];
    const option = runtimeFor(undefined, undefined, { Intl: recordingIntl(locales) }).compileOption(spec(columns()));
    expect(option.yAxis.axisLabel.formatter(1200)).toBe("1,200");
    expect(locales).toEqual(["en-US"]);
    expect(runtimeFor("pt_br invalid").compileOption(spec(columns())).yAxis.axisLabel.formatter(1200)).toBe("1,200");
  });

  test("ignores a well-formed but unsupported profile locale", () => {
    const option = runtimeFor("pt-br", { project: { locale: "zz" } }).compileOption(spec(columns()));
    expect(option.yAxis.axisLabel.formatter(1200)).toBe("1.200");
  });

  test("keeps a registered behavior formatter ahead of the default tooltip", () => {
    const option = runtimeFor("pt-br").compileOption(spec(columns(), { behavior: { formatter: "integer" } }));
    expect(option.tooltip.valueFormatter(1299.4)).toBe("1.299");
  });

  test("formats only numbers in tooltips and keeps text as it arrives", () => {
    const option = runtimeFor("pt-br").compileOption(spec(columns()));
    expect(option.tooltip.valueFormatter([1299, "abc", null, " ", "1299"])).toEqual(["1.299", "abc", "-", "-", "1299"]);
    expect(option.tooltip.valueFormatter("7.095")).toBe("7.095");
  });

  test("leaves labels picked through encode and non-numeric data untouched", () => {
    const runtime = runtimeFor("pt-br");
    const encoded = runtime.compileOption(spec({
      xAxis: { type: "value" },
      yAxis: { type: "category" },
      series: [{ type: "bar", label: { show: true }, encode: { x: 0, y: 1, label: 2 }, data: [[1055, "Groups", "1.055"]] }]
    }));
    expect(encoded.series[0].label.formatter).toBeUndefined();
    const scalarEncoded = runtime.compileOption(spec({
      xAxis: { type: "category", data: ["A"] },
      yAxis: { type: "value" },
      series: [{ type: "bar", label: { show: true }, encode: { y: 0 }, data: [1299] }]
    }));
    expect(scalarEncoded.series[0].label.formatter).toBeUndefined();
    const pie = runtime.compileOption(spec({ series: [{ type: "pie", label: { show: true }, data: [{ name: "A", value: 1299 }] }] }));
    expect(pie.series[0].label.formatter).toBeUndefined();
    const categories = runtime.compileOption(spec({
      xAxis: { type: "category" },
      yAxis: { type: "category" },
      series: [{ type: "line", label: { show: true }, data: [["A", "B"]] }]
    }));
    expect(categories.series[0].label.formatter).toBeUndefined();
  });

  test("labels the value-axis dimension of [x, y] items like the package presets", () => {
    const runtime = runtimeFor("pt-br");
    const vertical = runtime.compileOption(spec({
      xAxis: { type: "category" },
      yAxis: { type: "value" },
      series: [{ type: "bar", label: { show: true }, data: [{ value: ["Jan", 1299] }, ["Feb", 376], null] }]
    }));
    expect(vertical.series[0].label.formatter({ value: ["Jan", 1299] })).toBe("1.299");
    const horizontal = runtime.compileOption(spec({
      xAxis: { type: "value" },
      yAxis: { type: "category" },
      series: [{ type: "bar", label: { show: true }, data: [[7095, "A"]] }]
    }));
    expect(horizontal.series[0].label.formatter({ value: [7095, "A"] })).toBe("7.095");
  });

  test("infers axis types like ECharts when the option omits them", () => {
    const option = runtimeFor("pt-br").compileOption(spec({
      xAxis: {},
      yAxis: { data: ["Alpha", "Beta"] },
      series: [{ type: "bar", data: [1299, 7] }]
    }));
    expect(option.xAxis.axisLabel.formatter(1200)).toBe("1.200");
    expect(option.yAxis.axisLabel).toBeUndefined();
  });

  test("formats time-axis charts whose tooltip shows the value dimension", () => {
    const runtime = runtimeFor("pt-br");
    const plain = runtime.compileOption(spec({
      xAxis: { type: "time" },
      yAxis: {},
      series: [{ type: "line", label: { show: true }, data: [[1762128000000, 1299]] }]
    }));
    expect(plain.tooltip.valueFormatter(1299)).toBe("1.299");
    expect(plain.series[0].label.formatter({ value: [1762128000000, 1299] })).toBe("1.299");
    const encoded = runtime.compileOption(spec({
      xAxis: { type: "time" },
      yAxis: { type: "value" },
      series: [{ type: "line", encode: { x: 0, y: 1 }, data: [[1762128000000, 2450.5]] }]
    }));
    expect(encoded.tooltip.valueFormatter(2450.5)).toBe("2.450,5");
  });

  test("keeps ECharts dates in tooltips that can receive the time value", () => {
    const runtime = runtimeFor("pt-br");
    const schedule = runtime.compileOption(spec({
      xAxis: { type: "time" },
      yAxis: { type: "category" },
      series: [{ type: "scatter", data: [[1762128000000, "Task A"]] }]
    }));
    expect(schedule.tooltip.valueFormatter).toBeUndefined();
    const labelled = runtime.compileOption(spec({
      xAxis: { type: "time" },
      yAxis: { type: "value" },
      series: [{ type: "line", encode: { x: 0, y: 1, label: 0 }, data: [[1762128000000, 5]] }]
    }));
    expect(labelled.tooltip.valueFormatter).toBeUndefined();
  });
});

describe("narrow layouts", () => {
  test("keeps axis labels level and hides value labels that would touch", () => {
    const option = runtimeFor("pt-br").compileOption(spec(ranking()));
    expect(JSON.stringify(option.media).includes("rotate")).toBeFalse();
    expect(option.xAxis.axisLabel.hideOverlap).toBeTrue();
    expect(option.xAxis.axisLabel.formatter(1500)).toBe("1.500");
    expect(option.yAxis.axisLabel).toBeUndefined();
    expect([option.series[0].label.show, option.series[0].label.position]).toEqual([true, "right"]);
  });

  test("applies the plug-in grid only to charts without their own grid", () => {
    const runtime = runtimeFor("pt-br");
    const fallback = runtime.compileOption(spec(columns())).media;
    expect(fallback.map((entry) => entry.query.maxWidth)).toEqual([767, 389]);
    expect(fallback.map((entry) => entry.option.grid !== undefined)).toEqual([true, true]);
    const own = runtime.compileOption(spec({ ...columns(), grid: { left: 10, right: 46 } }));
    expect(own.media.map((entry) => entry.option.grid !== undefined)).toEqual([false, false]);
    expect(own.grid).toEqual({ left: 10, right: 46 });
  });
});
