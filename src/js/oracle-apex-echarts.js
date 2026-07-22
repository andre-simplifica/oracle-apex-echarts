(function attachOracleApexECharts(root, factory) {
  "use strict";

  if (root.OracleApexECharts?.version === "1.0.0") {
    if (typeof module === "object" && module.exports) {
      module.exports = root.OracleApexECharts;
    }
    return;
  }

  const api = factory(root);
  root.OracleApexECharts = api;

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis === "object" ? globalThis : window, function createRuntime(root) {
  "use strict";

  const VERSION = "1.0.0";
  const SCHEMA_VERSION = "1.0";
  const REQUIRED_RUNTIME = ">=1.0.0 <2.0.0";
  const ECHARTS_VERSION = "6.1.0";
  const HOST_SELECTOR = "[data-oracle-apex-echarts='1']";
  const ID_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,79}$/;
  const TOKEN_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
  const APEX_ITEM_PATTERN = /^[A-Z][A-Z0-9_]{0,254}$/;
  const APEX_IDENTIFIER_PATTERN = /^[A-Za-z][A-Za-z0-9_:-]{0,254}$/;
  const FILE_NAME_PATTERN = /^[A-Za-z0-9_-]{1,80}$/;
  const SAFE_SERIES_TYPES = new Set([
    "bar",
    "line",
    "pie",
    "gauge",
    "scatter"
  ]);
  const SAFE_FORMATTERS = new Set([
    "integer",
    "decimal_2",
    "percent",
    "currency_brl",
    "short_number",
    "date_br",
    "datetime_br"
  ]);
  const ROOT_SPEC_KEYS = new Set([
    "schemaVersion",
    "id",
    "generatedBy",
    "requiredRuntime",
    "theme",
    "renderer",
    "preset",
    "size",
    "accessibility",
    "behavior",
    "integration",
    "data"
  ]);
  const ROOT_OPTION_KEYS = new Set([
    "animation",
    "animationDuration",
    "aria",
    "backgroundColor",
    "calendar",
    "color",
    "dataZoom",
    "dataset",
    "grid",
    "legend",
    "media",
    "series",
    "textStyle",
    "title",
    "toolbox",
    "tooltip",
    "visualMap",
    "xAxis",
    "yAxis"
  ]);
  const NESTED_OPTION_KEYS = new Set([
    "activeOpacity",
    "align",
    "areaStyle",
    "axisLabel",
    "axisLine",
    "axisPointer",
    "axisTick",
    "avoidLabelOverlap",
    "backgroundColor",
    "barGap",
    "barMaxWidth",
    "barMinWidth",
    "barWidth",
    "borderColor",
    "borderRadius",
    "borderWidth",
    "bottom",
    "calendarIndex",
    "cellSize",
    "center",
    "children",
    "clip",
    "clockwise",
    "color",
    "colorAlpha",
    "colorLightness",
    "colorSaturation",
    "colorStops",
    "colorStops",
    "color",
    "confine",
    "connectNulls",
    "containLabel",
    "coordinateSystem",
    "data",
    "dataZoomIndex",
    "dayLabel",
    "decal",
    "detail",
    "dimension",
    "dimensions",
    "disabled",
    "distance",
    "edgeLabel",
    "emphasis",
    "enabled",
    "encode",
    "end",
    "endAngle",
    "feature",
    "fontFamily",
    "fontSize",
    "fontStyle",
    "fontWeight",
    "gapWidth",
    "height",
    "id",
    "inRange",
    "inside",
    "interval",
    "inverse",
    "itemGap",
    "itemHeight",
    "itemStyle",
    "itemWidth",
    "label",
    "labelLayout",
    "layout",
    "left",
    "legend",
    "levels",
    "lineStyle",
    "links",
    "max",
    "maxAngle",
    "maxHeight",
    "maxInterval",
    "maxWidth",
    "maxSize",
    "min",
    "minAngle",
    "minHeight",
    "minInterval",
    "minWidth",
    "minSize",
    "monthLabel",
    "name",
    "nameGap",
    "nameLocation",
    "nameTextStyle",
    "nodeAlign",
    "nodeGap",
    "nodeWidth",
    "nodes",
    "offset",
    "opacity",
    "option",
    "orient",
    "order",
    "padding",
    "pixelRatio",
    "position",
    "progress",
    "query",
    "range",
    "radius",
    "renderMode",
    "restore",
    "right",
    "roam",
    "rotate",
    "saveAsImage",
    "selectedMode",
    "seriesIndex",
    "shadowBlur",
    "shadowColor",
    "shadowOffsetX",
    "shadowOffsetY",
    "show",
    "showBackground",
    "showSymbol",
    "silent",
    "smooth",
    "sort",
    "source",
    "scale",
    "sampling",
    "splitArea",
    "splitLine",
    "splitNumber",
    "stack",
    "start",
    "startAngle",
    "symbol",
    "symbolSize",
    "step",
    "stillShowZeroSum",
    "target",
    "text",
    "textStyle",
    "top",
    "trigger",
    "type",
    "value",
    "valueAnimation",
    "width",
    "x",
    "xAxisIndex",
    "y",
    "yAxisIndex",
    "yearLabel"
  ]);
  const FORBIDDEN_OPTION_KEYS = new Set([
    "__proto__",
    "constructor",
    "dataView",
    "extraCssText",
    "formatter",
    "link",
    "prototype",
    "reg",
    "renderItem",
    "transform",
    "url"
  ]);
  const SAFE_PRESETS = new Set([
    "bar_vertical",
    "bar_horizontal",
    "bar_stacked",
    "line",
    "area",
    "bar_line",
    "pie",
    "donut",
    "gauge",
    "scatter",
    "advanced"
  ]);
  const CORE_DEFAULTS = Object.freeze({
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
  });

  const instances = new Map();
  const registeredThemes = new Set();
  const runtimeConfiguration = {
    installationDefaults: {},
    projectProfile: {},
    telemetry: false
  };
  let bootstrapped = false;
  let domObserver = null;

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function visualTokens() {
    return runtimeConfiguration.projectProfile.visual?.resolvedTokens
      ?? runtimeConfiguration.projectProfile.visual?.overrides
      ?? {};
  }

  function projectLocale() {
    return runtimeConfiguration.projectProfile.project?.locale ?? "en-US";
  }

  function projectTimeZone() {
    return runtimeConfiguration.projectProfile.project?.timeZone ?? "UTC";
  }

  function projectMessage(name, fallback) {
    const message = runtimeConfiguration.projectProfile.messages?.[name];
    return typeof message === "string" && message.length >= 1 && message.length <= 1000
      ? message
      : fallback;
  }

  function copyValue(value) {
    if (Array.isArray(value)) {
      return value.map(copyValue);
    }
    if (isPlainObject(value)) {
      const copy = {};
      for (const [key, child] of Object.entries(value)) {
        if (["__proto__", "constructor", "prototype"].includes(key)) {
          throw new Error(`Chave insegura: ${key}.`);
        }
        copy[key] = copyValue(child);
      }
      return copy;
    }
    return value;
  }

  function mergeConfiguration(...sources) {
    const target = {};

    for (const source of sources) {
      if (!isPlainObject(source)) {
        continue;
      }
      for (const [key, value] of Object.entries(source)) {
        if (value === undefined) {
          continue;
        }
        if (["__proto__", "constructor", "prototype"].includes(key)) {
          throw new Error(`Chave insegura: ${key}.`);
        }
        if (isPlainObject(value)) {
          target[key] = mergeConfiguration(isPlainObject(target[key]) ? target[key] : {}, value);
        } else {
          target[key] = copyValue(value);
        }
      }
    }

    return target;
  }

  function rejectUnknownKeys(value, allowed, path, errors) {
    if (!isPlainObject(value)) {
      errors.push(`${path} deve ser um objeto.`);
      return;
    }
    for (const key of Object.keys(value)) {
      if (!allowed.has(key)) {
        errors.push(`${path}.${key} não é suportado.`);
      }
    }
  }

  function countAndValidateOption(value, path, depth, limits, counters) {
    if (depth > limits.maxOptionDepth) {
      throw new Error(`A opção excede a profundidade permitida em ${path}.`);
    }
    if (typeof value === "function") {
      throw new Error(`Funções JavaScript não são permitidas em ${path}.`);
    }
    if (typeof value === "string") {
      const normalized = value.trim();
      if (/^(?:javascript|vbscript|data|file|ftp|https?):/i.test(normalized) || /^\/\//.test(normalized)) {
        throw new Error(`URL ou esquema não autorizado em ${path}.`);
      }
      if (/<\s*\/?\s*script(?:\s|>|\/|$)/i.test(normalized)) {
        throw new Error(`Markup executável não é permitido em ${path}.`);
      }
      return;
    }
    if (value === null || ["number", "boolean", "undefined"].includes(typeof value)) {
      if (typeof value === "number" && !Number.isFinite(value)) {
        throw new Error(`Número inválido em ${path}.`);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => countAndValidateOption(item, `${path}[${index}]`, depth + 1, limits, counters));
      return;
    }
    if (!isPlainObject(value)) {
      throw new Error(`Tipo não suportado em ${path}.`);
    }

    for (const [key, child] of Object.entries(value)) {
      counters.keys += 1;
      if (counters.keys > limits.maxOptionKeys) {
        throw new Error("A opção excede a quantidade de propriedades permitida.");
      }
      if (FORBIDDEN_OPTION_KEYS.has(key)) {
        throw new Error(`A opção ${path}.${key} é proibida.`);
      }
      if (depth === 0 && !ROOT_OPTION_KEYS.has(key)) {
        throw new Error(`A opção raiz ${key} não é suportada.`);
      }
      if (depth > 0 && !NESTED_OPTION_KEYS.has(key) && !/^\d+$/.test(key)) {
        throw new Error(`A opção ${path}.${key} não está na allowlist.`);
      }
      if (key === "type" && path.includes("series") && typeof child === "string" && !SAFE_SERIES_TYPES.has(child)) {
        throw new Error(`Tipo de série não suportado: ${child}.`);
      }
      countAndValidateOption(child, `${path}.${key}`, depth + 1, limits, counters);
    }
  }

  function validateOption(option, limits = CORE_DEFAULTS) {
    if (!isPlainObject(option)) {
      return ["$.data.option deve ser um objeto."];
    }
    try {
      countAndValidateOption(option, "$.data.option", 0, limits, { keys: 0 });
      return [];
    } catch (error) {
      return [error.message];
    }
  }

  function validateChartSpec(spec) {
    const errors = [];
    rejectUnknownKeys(spec, ROOT_SPEC_KEYS, "$", errors);
    if (!isPlainObject(spec)) {
      return errors;
    }

    if (spec.schemaVersion !== SCHEMA_VERSION) {
      errors.push(`$.schemaVersion deve ser ${SCHEMA_VERSION}.`);
    }
    if (!ID_PATTERN.test(spec.id ?? "")) {
      errors.push("$.id deve ser um identificador seguro de até 80 caracteres.");
    }
    if (spec.requiredRuntime !== REQUIRED_RUNTIME) {
      errors.push(`$.requiredRuntime deve ser ${REQUIRED_RUNTIME}.`);
    }
    if (spec.renderer !== undefined && !["canvas", "svg"].includes(spec.renderer)) {
      errors.push("$.renderer deve ser canvas ou svg.");
    }
    if (spec.theme !== undefined && !TOKEN_PATTERN.test(spec.theme)) {
      errors.push("$.theme deve ser um token seguro.");
    }
    if (spec.preset !== undefined && !SAFE_PRESETS.has(spec.preset)) {
      errors.push("$.preset não é suportado.");
    }
    const allowedTypes = runtimeConfiguration.projectProfile.charts?.allowedTypes;
    const presetType = {
      bar_vertical: "bar",
      bar_horizontal: "bar",
      bar_stacked: "bar",
      line: "line",
      area: "area",
      bar_line: "combo",
      pie: "pie",
      donut: "donut",
      gauge: "gauge",
      scatter: "scatter"
    }[spec.preset];
    if (presetType && Array.isArray(allowedTypes) && !allowedTypes.includes(presetType)) {
      errors.push(`$.preset usa um tipo não permitido pelo profile: ${presetType}.`);
    }

    const accessibilityKeys = new Set(["description", "fallbackText", "emptyText", "essential", "decal"]);
    rejectUnknownKeys(spec.accessibility, accessibilityKeys, "$.accessibility", errors);
    if (isPlainObject(spec.accessibility)) {
      if (typeof spec.accessibility.description !== "string" || spec.accessibility.description.length < 1 || spec.accessibility.description.length > 1000) {
        errors.push("$.accessibility.description é obrigatório.");
      }
      if (typeof spec.accessibility.fallbackText !== "string" || spec.accessibility.fallbackText.length < 1 || spec.accessibility.fallbackText.length > 1000) {
        errors.push("$.accessibility.fallbackText é obrigatório.");
      }
    }

    if (spec.size !== undefined) {
      rejectUnknownKeys(spec.size, new Set(["minHeight"]), "$.size", errors);
      if (isPlainObject(spec.size) && (!Number.isInteger(spec.size.minHeight) || spec.size.minHeight < 180 || spec.size.minHeight > 1600)) {
        errors.push("$.size.minHeight deve estar entre 180 e 1600.");
      }
    }

    if (spec.behavior !== undefined) {
      const behaviorKeys = new Set([
        "animation",
        "animationDuration",
        "download",
        "downloadFileName",
        "zoom",
        "legend",
        "labels",
        "tooltip",
        "aria",
        "formatter",
        "clickEvent",
        "selectionEvent",
        "restore",
        "magicType",
        "refreshStrategy"
      ]);
      rejectUnknownKeys(spec.behavior, behaviorKeys, "$.behavior", errors);
      if (isPlainObject(spec.behavior)) {
        if (spec.behavior.downloadFileName !== undefined && !FILE_NAME_PATTERN.test(spec.behavior.downloadFileName)) {
          errors.push("$.behavior.downloadFileName contém caracteres não permitidos.");
        }
        if (spec.behavior.formatter !== undefined && !SAFE_FORMATTERS.has(spec.behavior.formatter)) {
          errors.push("$.behavior.formatter não está registrado.");
        }
        if (spec.behavior.labels !== undefined && !["auto", "show", "hide"].includes(spec.behavior.labels)) {
          errors.push("$.behavior.labels não é suportado.");
        }
        if (spec.behavior.refreshStrategy !== undefined && !["replace", "merge"].includes(spec.behavior.refreshStrategy)) {
          errors.push("$.behavior.refreshStrategy não é suportado.");
        }
        if (spec.behavior.magicType !== undefined
          && (!Array.isArray(spec.behavior.magicType)
            || spec.behavior.magicType.length < 1
            || spec.behavior.magicType.length > 4
            || new Set(spec.behavior.magicType).size !== spec.behavior.magicType.length
            || spec.behavior.magicType.some((type) => !["line", "bar", "stack", "tiled"].includes(type)))) {
          errors.push("$.behavior.magicType contém opções não suportadas.");
        }
      }
    }

    if (spec.integration !== undefined) {
      rejectUnknownKeys(
        spec.integration,
        new Set(["regionId", "ajaxIdentifier", "itemsToSubmit", "responseGroup"]),
        "$.integration",
        errors
      );
      if (isPlainObject(spec.integration)) {
        if (spec.integration.regionId !== undefined && !APEX_IDENTIFIER_PATTERN.test(spec.integration.regionId)) {
          errors.push("$.integration.regionId é inválido.");
        }
        if (spec.integration.ajaxIdentifier !== undefined
          && (typeof spec.integration.ajaxIdentifier !== "string" || spec.integration.ajaxIdentifier.length < 1 || spec.integration.ajaxIdentifier.length > 4000)) {
          errors.push("$.integration.ajaxIdentifier é inválido.");
        }
        if (spec.integration.itemsToSubmit !== undefined
          && (!Array.isArray(spec.integration.itemsToSubmit)
            || spec.integration.itemsToSubmit.length > 100
            || new Set(spec.integration.itemsToSubmit).size !== spec.integration.itemsToSubmit.length
            || spec.integration.itemsToSubmit.some((item) => !APEX_ITEM_PATTERN.test(item)))) {
          errors.push("$.integration.itemsToSubmit contém item inválido.");
        }
        if (spec.integration.responseGroup !== undefined && !TOKEN_PATTERN.test(spec.integration.responseGroup)) {
          errors.push("$.integration.responseGroup é inválido.");
        }
      }
    }

    if (!isPlainObject(spec.data)) {
      errors.push("$.data deve ser um objeto.");
      return errors;
    }
    if (spec.data.mode === "inline") {
      rejectUnknownKeys(spec.data, new Set(["mode", "contract", "option"]), "$.data", errors);
      if (spec.data.contract !== "option") {
        errors.push("$.data.contract deve ser option.");
      }
      const profileLimits = mergeConfiguration(CORE_DEFAULTS, runtimeConfiguration.projectProfile.limits ?? {});
      errors.push(...validateOption(spec.data.option, profileLimits));
    } else if (spec.data.mode === "ajax") {
      rejectUnknownKeys(spec.data, new Set(["mode", "contract", "ajax"]), "$.data", errors);
      if (!isPlainObject(spec.data.ajax)) {
        errors.push("$.data.ajax deve ser um objeto.");
      } else {
        rejectUnknownKeys(spec.data.ajax, new Set(["transport", "processStaticId", "itemsToSubmit", "responseGroup"]), "$.data.ajax", errors);
        if (!["apexPlugin", "apexProcess"].includes(spec.data.ajax.transport)) {
          errors.push("$.data.ajax.transport não é suportado.");
        }
        if (spec.data.ajax.transport === "apexPlugin" && !spec.integration?.ajaxIdentifier) {
          errors.push("$.integration.ajaxIdentifier é obrigatório para apexPlugin.");
        }
        if (spec.data.ajax.transport === "apexProcess" && !/^[A-Za-z][A-Za-z0-9_:-]{0,254}$/.test(spec.data.ajax.processStaticId ?? "")) {
          errors.push("$.data.ajax.processStaticId é obrigatório e deve ser fixo.");
        }
        if (spec.data.ajax.itemsToSubmit !== undefined) {
          if (!Array.isArray(spec.data.ajax.itemsToSubmit) || spec.data.ajax.itemsToSubmit.length > 100 || spec.data.ajax.itemsToSubmit.some((item) => !APEX_ITEM_PATTERN.test(item))) {
            errors.push("$.data.ajax.itemsToSubmit contém item inválido.");
          }
        }
      }
    } else {
      errors.push("$.data.mode deve ser inline ou ajax.");
    }

    return errors;
  }

  function escapeScriptJson(value) {
    return JSON.stringify(value)
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e")
      .replace(/&/g, "\\u0026")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
  }

  function sanitizeFileName(value, fallback = "grafico") {
    const normalized = String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    return FILE_NAME_PATTERN.test(normalized) ? normalized : fallback;
  }

  function versionMajor(version) {
    const match = /^([0-9]+)\./.exec(version ?? "");
    return match ? Number(match[1]) : null;
  }

  function isRuntimeCompatible(spec) {
    const generatedBy = spec?.generatedBy ?? {};
    return spec?.schemaVersion === SCHEMA_VERSION
      && spec?.requiredRuntime === REQUIRED_RUNTIME
      && versionMajor(VERSION) === 1
      && (generatedBy.packageVersion === undefined || versionMajor(generatedBy.packageVersion) === versionMajor(VERSION))
      && (generatedBy.pluginVersion === undefined || versionMajor(generatedBy.pluginVersion) === versionMajor(VERSION));
  }

  function normalizeDefaults(defaults) {
    const allowed = new Set(Object.keys(CORE_DEFAULTS));
    const booleanKeys = ["animation", "download", "restore", "zoom", "aria", "decal"];
    if (Object.keys(defaults).some((key) => !allowed.has(key))
      || !["canvas", "svg"].includes(defaults.renderer)
      || !Number.isInteger(defaults.minHeight) || defaults.minHeight < 180 || defaults.minHeight > 1600
      || !Number.isInteger(defaults.animationDuration) || defaults.animationDuration < 0 || defaults.animationDuration > 10000
      || !["auto", "show", "hide"].includes(defaults.labels)
      || !["auto", "top", "bottom", "left", "right"].includes(defaults.legendPosition)
      || !Number.isInteger(defaults.inlinePayloadWarningBytes) || defaults.inlinePayloadWarningBytes < 1024
      || !Number.isInteger(defaults.pointsWarning) || defaults.pointsWarning < 100
      || !Number.isInteger(defaults.maxPayloadBytes) || defaults.maxPayloadBytes < 4096 || defaults.maxPayloadBytes > 16777216
      || !Number.isInteger(defaults.maxOptionDepth) || defaults.maxOptionDepth < 4 || defaults.maxOptionDepth > 32
      || !Number.isInteger(defaults.maxOptionKeys) || defaults.maxOptionKeys < 20 || defaults.maxOptionKeys > 10000
      || booleanKeys.some((key) => typeof defaults[key] !== "boolean")) {
      throw new Error("Configuração efetiva do gráfico inválida.");
    }
    return defaults;
  }

  function effectiveDefaults(spec) {
    const project = runtimeConfiguration.projectProfile;
    const policy = project.behavior?.downloadPolicy ?? "never";
    const requestedDownload = spec.behavior?.download === true;
    const projectDefaults = {
      renderer: project.behavior?.renderer,
      minHeight: project.responsive?.minHeight,
      animation: project.behavior?.animation === "never" ? false : true,
      download: policy === "always" || (policy === "allow" && requestedDownload),
      labels: project.behavior?.labels,
      legendPosition: project.behavior?.legendPosition,
      inlinePayloadWarningBytes: project.limits?.inlinePayloadWarningBytes,
      pointsWarning: project.limits?.pointsWarning,
      maxPayloadBytes: project.limits?.maxPayloadBytes,
      maxOptionDepth: project.limits?.maxOptionDepth,
      maxOptionKeys: project.limits?.maxOptionKeys
    };
    const defaults = normalizeDefaults(mergeConfiguration(
      CORE_DEFAULTS,
      runtimeConfiguration.installationDefaults,
      projectDefaults,
      {
        renderer: spec.renderer,
        minHeight: spec.size?.minHeight,
        animation: spec.behavior?.animation,
        animationDuration: spec.behavior?.animationDuration,
        restore: spec.behavior?.restore,
        zoom: spec.behavior?.zoom,
        labels: spec.behavior?.labels,
        aria: spec.behavior?.aria,
        decal: spec.accessibility?.decal
      }
    ));
    if (policy === "never") defaults.download = false;
    if (policy === "allow") defaults.download = requestedDownload;
    if (policy === "always" && spec.behavior?.download === false) defaults.download = false;
    return defaults;
  }

  const formatters = Object.freeze({
    integer: (value) => new Intl.NumberFormat(projectLocale(), { maximumFractionDigits: 0 }).format(Number(value)),
    decimal_2: (value) => new Intl.NumberFormat(projectLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value)),
    percent: (value) => new Intl.NumberFormat(projectLocale(), { style: "percent", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value)),
    currency_brl: (value) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value)),
    short_number: (value) => new Intl.NumberFormat(projectLocale(), { notation: "compact", maximumFractionDigits: 2 }).format(Number(value)),
    date_br: (value) => new Intl.DateTimeFormat(projectLocale(), { timeZone: projectTimeZone() }).format(new Date(value)),
    datetime_br: (value) => new Intl.DateTimeFormat(projectLocale(), { dateStyle: "short", timeStyle: "short", timeZone: projectTimeZone() }).format(new Date(value))
  });

  function legendPosition(position) {
    switch (position) {
      case "top": return { top: 0, left: "center" };
      case "bottom": return { bottom: 0, left: "center" };
      case "left": return { left: 0, top: "middle", orient: "vertical" };
      case "right": return { right: 0, top: "middle", orient: "vertical" };
      default: return {};
    }
  }

  function applySeriesLabels(option, mode) {
    if (!Array.isArray(option.series) || mode === "auto") {
      return;
    }
    const show = mode === "show";
    option.series = option.series.map((series) => mergeConfiguration(series, { label: { show } }));
  }

  function responsiveMedia(profile, option) {
    const hideBelow = profile.responsive?.hideLegendBelow ?? 0;
    const hasCartesianAxes = option.xAxis !== undefined || option.yAxis !== undefined;
    if (!hasCartesianAxes) {
      return [];
    }
    const mobileOption = {
      toolbox: { orient: "horizontal", right: 4, top: 4 }
    };
    mobileOption.grid = { left: 44, right: 18, top: 48, bottom: 54, containLabel: true };
    mobileOption.xAxis = { axisLabel: { rotate: 30 } };
    const narrowOption = {
      grid: { left: 36, right: 12, top: 44, bottom: 46, containLabel: true },
      toolbox: { show: false }
    };
    const media = [
      {
        query: { maxWidth: 767 },
        option: mobileOption
      },
      {
        query: { maxWidth: 389 },
        option: narrowOption
      }
    ];
    if (hideBelow > 0) {
      media.push({ query: { maxWidth: hideBelow - 1 }, option: { legend: { show: false } } });
    }
    return media;
  }

  function buildOption(spec) {
    const defaults = effectiveDefaults(spec);
    const profile = runtimeConfiguration.projectProfile;
    const option = copyValue(spec.data.option);
    const behavior = spec.behavior ?? {};
    const reduceMotion = typeof root.matchMedia === "function" && root.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const tokens = visualTokens();
    if (option.color === undefined && Array.isArray(tokens.palette)) {
      option.color = copyValue(tokens.palette);
    }
    if (option.backgroundColor === undefined && tokens.background && tokens.background !== "transparent") {
      option.backgroundColor = tokens.background;
    }
    option.animation = reduceMotion ? false : Boolean(defaults.animation);
    option.animationDuration = reduceMotion ? 0 : Number(defaults.animationDuration);
    option.aria = mergeConfiguration(option.aria, {
      enabled: Boolean(defaults.aria),
      label: {
        enabled: Boolean(defaults.aria),
        description: spec.accessibility.description
      },
      decal: { show: Boolean(defaults.decal) },
    });
    option.tooltip = mergeConfiguration(option.tooltip, {
      show: behavior.tooltip !== false,
      renderMode: "richText",
      confine: true
    });
    if (behavior.formatter) {
      option.tooltip.valueFormatter = formatters[behavior.formatter];
    }

    const position = behavior.legend?.position ?? defaults.legendPosition;
    option.legend = mergeConfiguration(option.legend, legendPosition(position), {
      show: behavior.legend?.show !== false
    });
    applySeriesLabels(option, defaults.labels);

    const features = {};
    if (defaults.download) {
      features.saveAsImage = {
        type: "png",
        name: sanitizeFileName(behavior.downloadFileName ?? spec.id),
        backgroundColor: tokens.background === "transparent" ? "#ffffff" : tokens.background,
        pixelRatio: 2,
        title: "Baixar imagem"
      };
    }
    if (defaults.restore) {
      features.restore = { title: "Restaurar" };
    }
    if (Array.isArray(behavior.magicType) && behavior.magicType.length > 0) {
      features.magicType = {
        type: copyValue(behavior.magicType),
        title: {
          line: "Exibir como linha",
          bar: "Exibir como barras",
          stack: "Empilhar séries",
          tiled: "Separar séries"
        }
      };
    }
    option.toolbox = mergeConfiguration(option.toolbox, {
      show: Object.keys(features).length > 0,
      orient: "horizontal",
      right: 8,
      top: 8,
      itemSize: 18,
      itemGap: 10,
      feature: features
    });
    if (defaults.zoom && option.dataZoom === undefined) {
      option.dataZoom = [{ type: "inside" }];
    }

    const media = [...(Array.isArray(option.media) ? option.media : []), ...responsiveMedia(profile, option)];
    if (media.length > 0) {
      option.media = media;
    } else {
      delete option.media;
    }
    return option;
  }

  function compileOption(spec) {
    const errors = validateChartSpec(spec);
    if (errors.length > 0) {
      throw new Error(errors[0]);
    }
    if (spec.data.mode !== "inline") {
      throw new Error("Somente ChartSpec inline pode ser compilado localmente.");
    }
    return buildOption(spec);
  }

  function countPoints(option) {
    let count = 0;
    if (Array.isArray(option.series)) {
      for (const series of option.series) {
        if (Array.isArray(series?.data)) {
          count += series.data.length;
        }
      }
    }
    if (Array.isArray(option.dataset?.source)) {
      count += option.dataset.source.length;
    }
    return count;
  }

  function debug(label, details) {
    if (!runtimeConfiguration.telemetry) {
      return;
    }
    const apexDebug = root.apex?.debug;
    if (apexDebug?.info) {
      apexDebug.info(`[OracleApexECharts] ${label}`, details);
    } else if (root.console?.debug) {
      root.console.debug(`[OracleApexECharts] ${label}`, details);
    }
  }

  function dispatch(host, name, detail) {
    const safeDetail = copyValue(detail);
    if (typeof root.CustomEvent === "function") {
      host.dispatchEvent(new root.CustomEvent(name, { bubbles: true, detail: safeDetail }));
    }
    if (root.apex?.jQuery) {
      root.apex.jQuery(host).trigger(name, [safeDetail]);
    }
  }

  function registerTheme(name) {
    const echarts = root.echarts;
    const profile = runtimeConfiguration.projectProfile;
    const tokens = visualTokens();
    if (!name || registeredThemes.has(name) || !echarts?.registerTheme) {
      return;
    }
    echarts.registerTheme(name, {
      color: copyValue(tokens.palette ?? []),
      backgroundColor: tokens.background ?? "transparent",
      textStyle: {
        color: tokens.textColor,
        fontFamily: tokens.fontFamily
      }
    });
    registeredThemes.add(name);
  }

  function findCanvas(host) {
    return host.querySelector(".oracle-apex-echarts__canvas");
  }

  function fallbackElement(host) {
    return host.querySelector(".oracle-apex-echarts__fallback");
  }

  function setState(host, state, message) {
    host.dataset.oaeState = state;
    const fallback = fallbackElement(host);
    if (fallback) {
      fallback.hidden = state === "ready" || state === "loading";
      if (message) {
        fallback.textContent = message;
      }
    }
  }

  function readSpec(host) {
    const specId = host.dataset.oaeSpecId;
    if (!specId || !ID_PATTERN.test(specId.replace(/__spec$/, ""))) {
      throw new Error("Referência de ChartSpec inválida.");
    }
    const script = host.ownerDocument.getElementById(specId);
    if (!script || script.type !== "application/json") {
      throw new Error("ChartSpec não encontrado.");
    }
    return JSON.parse(script.textContent);
  }

  function waitForSize(canvas, attempts = 24) {
    return new Promise((resolve) => {
      let remaining = attempts;
      const inspect = () => {
        const rectangle = canvas.getBoundingClientRect();
        if (rectangle.width > 0 && rectangle.height > 0) {
          resolve(true);
          return;
        }
        remaining -= 1;
        if (remaining <= 0) {
          resolve(false);
          return;
        }
        (root.requestAnimationFrame ?? root.setTimeout)(inspect);
      };
      inspect();
    });
  }

  function resizeState(state) {
    if (!state.chart || state.resizeScheduled) {
      return;
    }
    state.resizeScheduled = true;
    (root.requestAnimationFrame ?? root.setTimeout)(() => {
      state.resizeScheduled = false;
      const rectangle = state.canvas.getBoundingClientRect();
      if (rectangle.width === state.lastWidth && rectangle.height === state.lastHeight) {
        return;
      }
      state.lastWidth = rectangle.width;
      state.lastHeight = rectangle.height;
      state.chart.resize();
    });
  }

  function safeEventDetail(spec, parameters) {
    return {
      chartId: spec.id,
      seriesName: typeof parameters?.seriesName === "string" ? parameters.seriesName.slice(0, 200) : null,
      seriesType: typeof parameters?.seriesType === "string" ? parameters.seriesType.slice(0, 40) : null,
      name: typeof parameters?.name === "string" ? parameters.name.slice(0, 500) : null,
      value: ["string", "number", "boolean"].includes(typeof parameters?.value) ? parameters.value : null,
      dataIndex: Number.isInteger(parameters?.dataIndex) ? parameters.dataIndex : null,
      seriesIndex: Number.isInteger(parameters?.seriesIndex) ? parameters.seriesIndex : null
    };
  }

  function attachChartEvents(state) {
    state.chart.off("click");
    state.chart.off("legendselectchanged");
    if (state.spec.behavior?.clickEvent !== false) {
      state.chart.on("click", (parameters) => dispatch(state.host, "oracleapexechartsclick", safeEventDetail(state.spec, parameters)));
    }
    if (state.spec.behavior?.selectionEvent !== false) {
      state.chart.on("legendselectchanged", (parameters) => dispatch(state.host, "oracleapexechartsselection", {
        chartId: state.spec.id,
        name: typeof parameters?.name === "string" ? parameters.name.slice(0, 500) : null
      }));
    }
  }

  function registerApexRegion(state) {
    const regionId = state.spec.integration?.regionId;
    if (!regionId || !root.apex?.region?.create || state.regionRegistered) {
      return;
    }
    root.apex.region.create(regionId, {
      type: "OracleApexECharts",
      focus() {
        state.canvas.focus();
      },
      refresh() {
        return refresh(state.spec.id);
      },
      destroy() {
        dispose(state.spec.id, { destroyRegion: false });
      }
    });
    state.regionRegistered = true;
  }

  async function renderInline(state, spec) {
    const startedAt = performance.now();
    const errors = validateChartSpec(spec);
    if (errors.length > 0 || !isRuntimeCompatible(spec)) {
      throw new Error(errors[0] ?? "Versões do gráfico incompatíveis.");
    }
    if (!root.echarts || root.echarts.version !== ECHARTS_VERSION) {
      throw new Error(`Apache ECharts ${ECHARTS_VERSION} não está disponível.`);
    }

    const defaults = effectiveDefaults(spec);
    const responsive = runtimeConfiguration.projectProfile.responsive ?? {};
    const breakpoints = responsive.breakpoints ?? [];
    const payloadBytes = new TextEncoder().encode(JSON.stringify(spec)).length;
    const limits = mergeConfiguration(CORE_DEFAULTS, runtimeConfiguration.projectProfile.limits ?? {});
    if (limits.maxPayloadBytes && payloadBytes > limits.maxPayloadBytes) {
      throw new Error("ChartSpec payload exceeds the configured hard limit.");
    }
    state.host.style?.setProperty("--oae-min-height", `${defaults.minHeight}px`);
    state.host.style?.setProperty("--oae-mobile-min-height", `${Math.max(240, defaults.minHeight - 20)}px`);
    state.host.style?.setProperty("--oae-narrow-min-height", `${Math.max(220, defaults.minHeight - 40)}px`);
    state.host.style?.setProperty("--oae-mobile-breakpoint", `${breakpoints.find((value) => value >= 768) ?? 768}px`);
    state.canvas.setAttribute("role", "img");
    state.canvas.setAttribute("aria-label", spec.accessibility.description);
    const hasSize = await waitForSize(state.canvas);
    if (!hasSize) {
      state.pendingVisibility = true;
      return false;
    }
    state.pendingVisibility = false;

    const option = buildOption(spec);
    const points = countPoints(option);
    registerTheme(spec.theme);
    state.chart = root.echarts.getInstanceByDom(state.canvas)
      ?? root.echarts.init(state.canvas, spec.theme || null, { renderer: defaults.renderer });
    state.spec = spec;
    registerApexRegion(state);
    if (payloadBytes >= limits.inlinePayloadWarningBytes || points >= limits.pointsWarning) {
      debug("limite preventivo", { chartId: spec.id, payloadBytes, points });
    }

    state.chart.setOption(option, {
      notMerge: spec.behavior?.refreshStrategy !== "merge",
      lazyUpdate: true
    });
    if (points === 0) {
      state.chart.clear?.();
      setState(
        state.host,
        "empty",
        spec.accessibility.emptyText ?? projectMessage("empty", "Não há dados para exibir.")
      );
      dispatch(state.host, "oracleapexechartsready", { chartId: spec.id, points: 0 });
      return true;
    }
    attachChartEvents(state);
    setState(state.host, "ready");
    dispatch(state.host, "oracleapexechartsready", { chartId: spec.id, points });
    debug("render", {
      chartId: spec.id,
      points,
      payloadBytes,
      renderMilliseconds: Math.round((performance.now() - startedAt) * 100) / 100,
      instances: instances.size
    });
    return true;
  }

  function normalizeAjaxResponse(response, chartId) {
    if (isPlainObject(response?.chartSpec)) {
      return response.chartSpec;
    }
    if (isPlainObject(response?.charts?.[chartId])) {
      return response.charts[chartId];
    }
    if (isPlainObject(response) && response.schemaVersion) {
      return response;
    }
    throw new Error("Resposta AJAX não contém um ChartSpec válido.");
  }

  function requestAjax(state) {
    const ajax = state.sourceSpec.data.mode === "ajax"
      ? state.sourceSpec.data.ajax
      : {
          transport: "apexPlugin",
          itemsToSubmit: state.sourceSpec.integration.itemsToSubmit ?? [],
          responseGroup: state.sourceSpec.integration.responseGroup
        };
    const items = (ajax.itemsToSubmit ?? []).map((item) => `#${item}`).join(",");
    const options = {
      dataType: "json",
      loadingIndicator: state.canvas,
      queue: {
        name: `oracle-apex-echarts-${ajax.responseGroup ?? state.sourceSpec.id}`,
        action: "replace"
      }
    };
    const data = items ? { pageItems: items } : {};

    if (!root.apex?.server) {
      throw new Error("APEX server não está disponível.");
    }
    if (ajax.transport === "apexPlugin") {
      return root.apex.server.plugin(state.sourceSpec.integration.ajaxIdentifier, data, options);
    }
    return root.apex.server.process(ajax.processStaticId, data, options);
  }

  async function loadAjax(state) {
    state.revision += 1;
    const revision = state.revision;
    if (state.request?.abort) {
      state.request.abort();
    }
    setState(state.host, "loading");
    state.request = requestAjax(state);
    let response;
    try {
      response = await Promise.resolve(state.request);
    } catch (error) {
      if (revision !== state.revision) {
        return false;
      }
      throw error;
    }
    if (revision !== state.revision) {
      return false;
    }
    const receivedSpec = normalizeAjaxResponse(response, state.sourceSpec.id);
    const inlineSpec = mergeConfiguration(state.sourceSpec, receivedSpec, {
      id: state.sourceSpec.id,
      integration: state.sourceSpec.integration
    });
    inlineSpec.data = copyValue(receivedSpec.data);
    if (inlineSpec.data?.mode !== "inline") {
      throw new Error("Resposta AJAX deve usar data.mode inline.");
    }
    return renderInline(state, inlineSpec);
  }

  function createObserver(state) {
    if (typeof root.ResizeObserver !== "function") {
      return;
    }
    state.resizeObserver = new root.ResizeObserver(() => resizeState(state));
    state.resizeObserver.observe(state.canvas);
  }

  async function initializeHost(host) {
    let spec;
    try {
      spec = readSpec(host);
      const errors = validateChartSpec(spec);
      if (errors.length > 0) {
        throw new Error(errors[0]);
      }
      if (instances.has(spec.id)) {
        const existing = instances.get(spec.id);
        if (existing.host === host) {
          if (existing.pendingVisibility) {
            return await renderInline(existing, existing.spec);
          }
          return true;
        }
        throw new Error(`ID duplicado: ${spec.id}.`);
      }

      const state = {
        host,
        canvas: findCanvas(host),
        spec,
        sourceSpec: spec,
        chart: null,
        request: null,
        revision: 0,
        resizeObserver: null,
        resizeScheduled: false,
        lastWidth: 0,
        lastHeight: 0,
        pendingVisibility: false,
        regionRegistered: false
      };
      if (!state.canvas) {
        throw new Error("Contêiner do gráfico não encontrado.");
      }
      instances.set(spec.id, state);
      createObserver(state);
      setState(host, "loading");
      return spec.data.mode === "ajax"
        ? await loadAjax(state)
        : await renderInline(state, spec);
    } catch (error) {
      const id = spec?.id;
      if (id && instances.has(id)) {
        const state = instances.get(id);
        setState(
          host,
          "error",
          spec.accessibility?.fallbackText ?? projectMessage("error", "Não foi possível exibir o gráfico.")
        );
        dispatch(host, "oracleapexechartserror", { chartId: id, message: "Falha ao exibir o gráfico." });
        debug("erro", { chartId: id, message: error.message });
        if (!state.chart) {
          state.pendingVisibility = false;
        }
      } else {
        setState(host, "error", projectMessage("error", "Não foi possível exibir o gráfico."));
        debug("erro", { message: error.message });
      }
      return false;
    }
  }

  function scan(rootElement = root.document) {
    if (!rootElement?.querySelectorAll) {
      return Promise.resolve([]);
    }
    loadDocumentConfiguration(rootElement);
    const hosts = [];
    if (rootElement.matches?.(HOST_SELECTOR)) {
      hosts.push(rootElement);
    }
    hosts.push(...rootElement.querySelectorAll(HOST_SELECTOR));
    return Promise.all(hosts.map(initializeHost));
  }

  function loadDocumentConfiguration(rootElement = root.document) {
    if (!rootElement?.querySelectorAll) {
      return;
    }
    const scripts = rootElement.querySelectorAll("script[data-oracle-apex-echarts-config='1']:not([data-oae-loaded='1'])");
    for (const script of scripts) {
      try {
        configure(JSON.parse(script.textContent));
        script.dataset.oaeLoaded = "1";
      } catch (error) {
        debug("configuração ignorada", { message: error.message });
      }
    }
  }

  function dispose(id, options = {}) {
    const state = instances.get(id);
    if (!state) {
      return false;
    }
    state.revision += 1;
    if (state.request?.abort) {
      state.request.abort();
    }
    state.resizeObserver?.disconnect();
    state.chart?.off("click");
    state.chart?.off("legendselectchanged");
    state.chart?.dispose();
    if (options.destroyRegion !== false && state.regionRegistered && state.spec.integration?.regionId && root.apex?.region?.destroy) {
      state.regionRegistered = false;
      root.apex.region.destroy(state.spec.integration.regionId);
    }
    instances.delete(id);
    dispatch(state.host, "oracleapexechartsdisposed", { chartId: id });
    debug("dispose", { chartId: id, instances: instances.size });
    return true;
  }

  function disposeWithin(element) {
    for (const [id, state] of instances) {
      if (element === state.host || element?.contains?.(state.host)) {
        dispose(id, { destroyRegion: false });
      }
    }
  }

  async function refresh(id) {
    const state = instances.get(id);
    if (!state) {
      return false;
    }
    try {
      if (state.sourceSpec.data.mode === "ajax" || state.sourceSpec.integration?.ajaxIdentifier) {
        return await loadAjax(state);
      }
      return await renderInline(state, state.spec);
    } catch (error) {
      setState(
        state.host,
        "error",
        state.spec.accessibility?.fallbackText ?? projectMessage("error", "Não foi possível exibir o gráfico.")
      );
      dispatch(state.host, "oracleapexechartserror", {
        chartId: id,
        message: "Falha ao atualizar o gráfico."
      });
      debug("erro no refresh", { chartId: id, message: error.message });
      return false;
    }
  }

  function cleanupRemovedHosts() {
    for (const [id, state] of instances) {
      if (!root.document.contains(state.host)) {
        dispose(id);
      }
    }
  }

  function bindApexLifecycle() {
    const jq = root.apex?.jQuery;
    if (jq) {
      jq(root.document)
        .off(".oracleApexECharts")
        .on("apexbeforerefresh.oracleApexECharts", (event) => disposeWithin(event.target))
        .on("apexafterrefresh.oracleApexECharts apexaftershow.oracleApexECharts", (event) => scan(event.target));
    } else {
      root.document.addEventListener("apexbeforerefresh", (event) => disposeWithin(event.target));
      root.document.addEventListener("apexafterrefresh", (event) => scan(event.target));
      root.document.addEventListener("apexaftershow", (event) => scan(event.target));
    }
  }

  function bootstrap() {
    if (!root.document) {
      return false;
    }
    if (bootstrapped) {
      loadDocumentConfiguration();
      scan();
      return true;
    }
    bootstrapped = true;
    loadDocumentConfiguration();
    bindApexLifecycle();
    if (typeof root.MutationObserver === "function") {
      domObserver = new root.MutationObserver(cleanupRemovedHosts);
      domObserver.observe(root.document.documentElement, { childList: true, subtree: true });
    }
    if (root.document.readyState === "loading") {
      root.document.addEventListener("DOMContentLoaded", () => scan(), { once: true });
    } else {
      scan();
    }
    return true;
  }

  function configure(configuration = {}) {
    if (!isPlainObject(configuration)) {
      throw new Error("Configuração do runtime inválida.");
    }
    runtimeConfiguration.installationDefaults = mergeConfiguration(
      runtimeConfiguration.installationDefaults,
      configuration.installationDefaults ?? {}
    );
    runtimeConfiguration.projectProfile = mergeConfiguration(
      runtimeConfiguration.projectProfile,
      configuration.projectProfile ?? {}
    );
    if (configuration.telemetry !== undefined) {
      runtimeConfiguration.telemetry = Boolean(configuration.telemetry);
    }
    return copyValue(runtimeConfiguration);
  }

  const api = {
    version: VERSION,
    schemaVersion: SCHEMA_VERSION,
    echartsVersion: ECHARTS_VERSION,
    bootstrap,
    configure,
    compileOption,
    dispose,
    refresh,
    scan,
    validateChartSpec,
    validateOption,
    mergeConfiguration,
    escapeScriptJson,
    sanitizeFileName,
    isRuntimeCompatible,
    loadDocumentConfiguration,
    registrySize() {
      return instances.size;
    }
  };

  return Object.freeze(api);
});
