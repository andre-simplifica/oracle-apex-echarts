import { lstat, readFile, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parse as parseYaml } from "yaml";

const REPOSITORY_ROOT = resolve(dirname(new URL(import.meta.url).pathname), "..");
const PROFILE_SCHEMA_PATH = resolve(REPOSITORY_ROOT, "schemas/project-profile.schema.json");
const NEUTRAL_PROFILE_PATH = resolve(REPOSITORY_ROOT, "profiles/neutral.yaml");
const COLOR = /^#[0-9A-Fa-f]{6}$/;
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype", "eval", "renderItem", "formatter", "url", "html"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function deepMerge(...sources) {
  const result = {};
  for (const source of sources) {
    if (!isPlainObject(source)) continue;
    for (const [key, value] of Object.entries(source)) {
      if (DANGEROUS_KEYS.has(key)) throw new Error(`Unsafe profile key: ${key}`);
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        if (value.length > 0) result[key] = structuredClone(value);
      } else if (isPlainObject(value)) {
        result[key] = deepMerge(isPlainObject(result[key]) ? result[key] : {}, value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

export function stableJson(value) {
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

async function validator() {
  const schema = JSON.parse(await readFile(PROFILE_SCHEMA_PATH, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv.compile(schema);
}

export async function parseProfileFile(path) {
  const source = await readFile(path, "utf8");
  const parsed = /\.json$/i.test(path) ? JSON.parse(source) : parseYaml(source);
  if (!isPlainObject(parsed)) throw new Error(`Profile must be an object: ${path}`);
  return parsed;
}

export async function validateProfile(profile) {
  const validate = await validator();
  if (validate(profile)) return [];
  return (validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message}`);
}

function uniqueColors(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && COLOR.test(value)))].slice(0, 32);
}

export function mapBrandReportKitProfile(profile) {
  if (!isPlainObject(profile?.colors) || profile.schema_version !== "1.0") {
    throw new Error("Oracle APEX Brand Report Kit profile is missing schema_version 1.0 or colors.");
  }
  const primitive = Object.values(profile.colors.primitive ?? {});
  const semantic = profile.colors.semantic ?? {};
  const screen = profile.colors.screen ?? {};
  const print = profile.colors.print ?? {};
  const families = profile.typography?.families ?? {};
  const fallbacks = Array.isArray(profile.typography?.fallbacks) ? profile.typography.fallbacks : [];
  const breakpoints = Object.values(profile.responsive?.breakpoints ?? {})
    .filter(Number.isInteger)
    .sort((left, right) => left - right);
  const palette = uniqueColors([
    semantic.primary,
    ...primitive,
    semantic.success,
    semantic.warning,
    semantic.danger
  ]);
  if (palette.length === 0) throw new Error("Brand Report Kit profile does not provide usable hexadecimal colors.");
  return {
    palette,
    fontFamily: [families.body ?? families.display, ...fallbacks].filter(Boolean).join(", "),
    background: screen.page ?? profile.layout?.backgrounds?.page ?? "transparent",
    surface: semantic.surface ?? screen.surface ?? "#FFFFFF",
    textColor: semantic.text ?? print.text ?? "#172033",
    mutedColor: semantic.muted ?? print.muted ?? "#526079",
    lineColor: print.line ?? semantic.border ?? "#AAB4C5",
    borderColor: semantic.border ?? print.line ?? "#D8DEEA",
    breakpoints,
    reducedMotion: profile.accessibility?.reduced_motion ?? true,
    minimumContrast: profile.accessibility?.minimum_contrast ?? 4.5
  };
}

async function safeProjectFile(projectRoot, configuredPath) {
  const candidate = resolve(projectRoot, configuredPath);
  const relation = relative(projectRoot, candidate);
  if (relation.startsWith("..") || isAbsolute(relation)) {
    throw new Error(`Profile path leaves the project root: ${configuredPath}`);
  }
  const metadata = await lstat(candidate);
  if (metadata.isSymbolicLink()) throw new Error(`Symbolic links are not allowed for profiles: ${configuredPath}`);
  const realRoot = await realpath(projectRoot);
  const realCandidate = await realpath(candidate);
  const realRelation = relative(realRoot, realCandidate);
  if (realRelation.startsWith("..") || isAbsolute(realRelation)) {
    throw new Error(`Resolved profile path leaves the project root: ${configuredPath}`);
  }
  return realCandidate;
}

export async function compileProjectProfile(profilePath, options = {}) {
  const projectRoot = resolve(options.projectRoot ?? dirname(profilePath));
  const neutral = await parseProfileFile(NEUTRAL_PROFILE_PATH);
  const profile = await parseProfileFile(profilePath);
  const errors = await validateProfile(profile);
  if (errors.length > 0) throw new Error(`Invalid project profile:\n- ${errors.join("\n- ")}`);

  const notices = [];
  const configuredBrandPath = profile.visual.brandReportKit?.profilePath
    ?? ".apex-brand-report-kit/brand-profile.json";
  let providerTokens = {};
  let visualSource = "neutral";

  if (profile.visual.provider !== "neutral") {
    try {
      const brandPath = await safeProjectFile(projectRoot, configuredBrandPath);
      const brand = JSON.parse(await readFile(brandPath, "utf8"));
      providerTokens = mapBrandReportKitProfile(brand);
      visualSource = "oracle-apex-brand-report-kit";
      notices.push(`Using Oracle APEX Brand Report Kit profile: ${configuredBrandPath}`);
    } catch (error) {
      if (profile.visual.provider === "oracle-apex-brand-report-kit") {
        throw new Error(`The configured Oracle APEX Brand Report Kit profile is required and invalid or missing: ${configuredBrandPath}. ${error.message}`);
      }
      notices.push(`Brand Report Kit profile not used (${error.message}); using the neutral profile.`);
    }
  }

  const resolvedTokens = deepMerge(
    neutral.visual.overrides,
    providerTokens,
    profile.visual.overrides
  );
  if (Object.keys(profile.visual.overrides ?? {}).length > 0) visualSource = "project-overrides";
  const compiled = deepMerge(neutral, profile);
  compiled.visual = deepMerge(profile.visual, { resolvedTokens, source: visualSource });
  const compiledErrors = await validateProfile(compiled);
  if (compiledErrors.length > 0) throw new Error(`Compiled profile is invalid:\n- ${compiledErrors.join("\n- ")}`);
  return { profile: compiled, notices };
}

const QUESTION_TYPES = Object.freeze({
  trend: ["line", "area"],
  comparison: ["bar", "combo"],
  ranking: ["bar"],
  composition: ["donut", "pie", "bar"],
  progress: ["gauge", "bar"],
  correlation: ["scatter"]
});

export function resolveChartType({ question = "comparison", requestedType = null, profile }) {
  const allowed = profile.charts.allowedTypes;
  if (requestedType) {
    if (!allowed.includes(requestedType)) throw new Error(`Requested chart type is not allowed: ${requestedType}`);
    return { type: requestedType, reason: "explicit-task-request" };
  }
  const adequate = QUESTION_TYPES[question] ?? allowed;
  const preferred = profile.charts.preferredType;
  if (adequate.includes(preferred) && allowed.includes(preferred)) {
    return { type: preferred, reason: "project-preference" };
  }
  if (profile.charts.preferencePolicy === "require") {
    throw new Error(`Required chart type ${preferred} is not appropriate for ${question}; choose explicitly instead of substituting silently.`);
  }
  const candidate = adequate.find((type) => allowed.includes(type));
  if (!candidate) throw new Error(`No allowed chart type can answer ${question}.`);
  return { type: candidate, reason: "managerial-fit" };
}

export function resolveDownload({ profile, chartRequested = false, serverAuthorized = false }) {
  const policy = profile.behavior.downloadPolicy;
  if (!serverAuthorized || policy === "never") return false;
  if (policy === "always") return true;
  return policy === "allow" && chartRequested;
}

export { NEUTRAL_PROFILE_PATH, PROFILE_SCHEMA_PATH };
