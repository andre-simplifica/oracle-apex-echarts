#!/usr/bin/env python3
"""Validate and deterministically compile Oracle APEX ECharts profile 1.0."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import tempfile
from pathlib import Path
from typing import Any


SKILL_ROOT = Path(__file__).resolve().parents[1]
NEUTRAL_PROFILE = SKILL_ROOT / "assets" / "neutral-profile" / "profile.yaml"
CHART_TYPES = {"bar", "line", "area", "combo", "pie", "donut", "gauge", "scatter"}
COLOR = re.compile(r"#[0-9A-Fa-f]{6}")
FORBIDDEN = {"eval", "function", "renderItem", "formatter", "html", "url", "callback", "__proto__", "prototype", "constructor"}


class ProfileError(RuntimeError):
    pass


def scalar(value: str) -> Any:
    value = value.strip()
    if not value:
        return None
    if value.startswith("[") and value.endswith("]"):
        body = value[1:-1].strip()
        return [] if not body else [scalar(part) for part in body.split(",")]
    if value in {"null", "~"}:
        return None
    if value.lower() in {"true", "false"}:
        return value.lower() == "true"
    if re.fullmatch(r"-?[0-9]+", value):
        return int(value)
    if re.fullmatch(r"-?[0-9]+\.[0-9]+", value):
        return float(value)
    if value[:1] in {'"', "'"} and value[-1:] == value[:1]:
        return json.loads(value) if value.startswith('"') else value[1:-1].replace("''", "'")
    return value


def parse_yaml_subset(source: str) -> dict[str, Any]:
    rows: list[tuple[int, str, int]] = []
    for number, raw in enumerate(source.splitlines(), 1):
        if not raw.strip() or raw.lstrip().startswith("#"):
            continue
        if "\t" in raw:
            raise ProfileError(f"line {number}: tabs are not allowed")
        indent = len(raw) - len(raw.lstrip(" "))
        if indent % 2:
            raise ProfileError(f"line {number}: indentation must use two spaces")
        rows.append((indent, raw.strip(), number))

    def block(index: int, indent: int) -> tuple[Any, int]:
        if index >= len(rows) or rows[index][0] < indent:
            return {}, index
        is_list = rows[index][1].startswith("- ")
        result: Any = [] if is_list else {}
        while index < len(rows) and rows[index][0] == indent:
            _, text, number = rows[index]
            if is_list:
                if not text.startswith("- "):
                    raise ProfileError(f"line {number}: mixed list and mapping")
                result.append(scalar(text[2:]))
                index += 1
                continue
            if text.startswith("- ") or ":" not in text:
                raise ProfileError(f"line {number}: expected key: value")
            key, raw_value = text.split(":", 1)
            key = key.strip()
            if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]*", key):
                raise ProfileError(f"line {number}: invalid key {key!r}")
            if key in result:
                raise ProfileError(f"line {number}: duplicate key {key!r}")
            index += 1
            if raw_value.strip():
                result[key] = scalar(raw_value)
            elif index < len(rows) and rows[index][0] > indent:
                result[key], index = block(index, rows[index][0])
            else:
                result[key] = {}
        return result, index

    parsed, consumed = block(0, rows[0][0] if rows else 0)
    if consumed != len(rows) or not isinstance(parsed, dict):
        raise ProfileError("profile must be one mapping")
    return parsed


def read_profile(path: Path) -> dict[str, Any]:
    source = path.read_text(encoding="utf-8")
    parsed = json.loads(source) if path.suffix.lower() == ".json" else parse_yaml_subset(source)
    if not isinstance(parsed, dict):
        raise ProfileError(f"profile must be an object: {path}")
    return parsed


def mapping(value: Any, path: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ProfileError(f"{path} must be a mapping")
    return value


def exact_keys(value: dict[str, Any], allowed: set[str], required: set[str], path: str) -> None:
    missing = sorted(required - set(value))
    unknown = sorted(set(value) - allowed)
    if missing:
        raise ProfileError(f"{path} missing keys: {', '.join(missing)}")
    if unknown:
        raise ProfileError(f"{path} unknown keys: {', '.join(unknown)}")


def integer(value: Any, minimum: int, maximum: int | None, path: str) -> None:
    if isinstance(value, bool) or not isinstance(value, int) or value < minimum or (maximum is not None and value > maximum):
        raise ProfileError(f"{path} is outside its integer range")


def validate_visual_tokens(value: Any, path: str) -> None:
    tokens = mapping(value, path)
    allowed = {"palette", "fontFamily", "background", "surface", "textColor", "mutedColor", "lineColor", "borderColor", "breakpoints", "reducedMotion", "minimumContrast"}
    exact_keys(tokens, allowed, set(), path)
    palette = tokens.get("palette", [])
    if not isinstance(palette, list) or len(palette) > 32 or any(not isinstance(color, str) or not COLOR.fullmatch(color) for color in palette):
        raise ProfileError(f"{path}.palette accepts at most 32 six-digit hex colors")
    if len(set(palette)) != len(palette):
        raise ProfileError(f"{path}.palette contains duplicate colors")
    font = tokens.get("fontFamily")
    if font is not None and (not isinstance(font, str) or len(font) > 240):
        raise ProfileError(f"{path}.fontFamily is invalid")
    for name in ("background", "surface", "textColor", "mutedColor", "lineColor", "borderColor"):
        color = tokens.get(name)
        if color is not None and (not isinstance(color, str) or (color != "transparent" and not COLOR.fullmatch(color))):
            raise ProfileError(f"{path}.{name} is invalid")
    breakpoints = tokens.get("breakpoints", [])
    if not isinstance(breakpoints, list) or len(breakpoints) > 12:
        raise ProfileError(f"{path}.breakpoints is invalid")
    for index, value in enumerate(breakpoints):
        integer(value, 280, 4096, f"{path}.breakpoints[{index}]")
    if len(set(breakpoints)) != len(breakpoints):
        raise ProfileError(f"{path}.breakpoints contains duplicates")
    reduced = tokens.get("reducedMotion")
    if reduced is not None and not isinstance(reduced, bool):
        raise ProfileError(f"{path}.reducedMotion is invalid")
    contrast = tokens.get("minimumContrast")
    if contrast is not None and (isinstance(contrast, bool) or not isinstance(contrast, (int, float)) or not 3 <= contrast <= 21):
        raise ProfileError(f"{path}.minimumContrast is invalid")


def validate(profile: dict[str, Any], compiled: bool = False) -> None:
    required = {"schemaVersion", "project", "visual", "charts", "integration", "behavior", "responsive", "limits", "messages"}
    exact_keys(profile, required, required, "profile")
    if profile["schemaVersion"] != "1.0":
        raise ProfileError("schemaVersion must be 1.0")

    project = mapping(profile["project"], "project")
    exact_keys(project, {"name", "locale", "timeZone"}, {"name", "locale", "timeZone"}, "project")
    if not isinstance(project["name"], str) or not 1 <= len(project["name"]) <= 120:
        raise ProfileError("project.name is invalid")
    if not re.fullmatch(r"[a-z]{2}(?:-[A-Z]{2})?", str(project["locale"])):
        raise ProfileError("project.locale is invalid")
    if not re.fullmatch(r"(?:UTC|[A-Za-z_]+(?:/[A-Za-z_+-]+)+)", str(project["timeZone"])):
        raise ProfileError("project.timeZone must be UTC or an IANA identifier")

    visual = mapping(profile["visual"], "visual")
    visual_allowed = {"provider", "brandReportKit", "fallback", "overrides"}
    if compiled:
        visual_allowed |= {"resolvedTokens", "source"}
    exact_keys(visual, visual_allowed, {"provider", "fallback", "overrides"}, "visual")
    if visual["provider"] not in {"auto", "oracle-apex-brand-report-kit", "neutral"} or visual["fallback"] != "neutral":
        raise ProfileError("visual provider/fallback is invalid")
    if "brandReportKit" in visual:
        brand = mapping(visual["brandReportKit"], "visual.brandReportKit")
        exact_keys(brand, {"profilePath"}, {"profilePath"}, "visual.brandReportKit")
        if not isinstance(brand["profilePath"], str) or not 1 <= len(brand["profilePath"]) <= 500:
            raise ProfileError("visual.brandReportKit.profilePath is invalid")
    validate_visual_tokens(visual["overrides"], "visual.overrides")
    if compiled:
        validate_visual_tokens(visual["resolvedTokens"], "visual.resolvedTokens")
        if visual["source"] not in {"project-overrides", "oracle-apex-brand-report-kit", "neutral"}:
            raise ProfileError("visual.source is invalid")

    charts = mapping(profile["charts"], "charts")
    exact_keys(charts, {"preferredType", "preferencePolicy", "allowedTypes"}, {"preferredType", "preferencePolicy", "allowedTypes"}, "charts")
    allowed = charts["allowedTypes"]
    if charts["preferredType"] not in CHART_TYPES or charts["preferencePolicy"] not in {"prefer", "require"}:
        raise ProfileError("chart preference is invalid")
    if not isinstance(allowed, list) or not allowed or any(not isinstance(value, str) for value in allowed):
        raise ProfileError("charts.allowedTypes is invalid")
    if len(set(allowed)) != len(allowed) or not set(allowed) <= CHART_TYPES:
        raise ProfileError("charts.allowedTypes is invalid")
    if charts["preferredType"] not in allowed:
        raise ProfileError("charts.preferredType must be allowed")

    integration = mapping(profile["integration"], "integration")
    exact_keys(integration, {"defaultMode"}, {"defaultMode"}, "integration")
    if integration["defaultMode"] not in {"plugin", "dynamic-content", "auto", "mixed"}:
        raise ProfileError("integration.defaultMode is invalid")

    behavior = mapping(profile["behavior"], "behavior")
    behavior_keys = {"renderer", "downloadPolicy", "animation", "labels", "legendPosition"}
    exact_keys(behavior, behavior_keys, behavior_keys, "behavior")
    enums = {
        "renderer": {"canvas", "svg"},
        "downloadPolicy": {"never", "allow", "always"},
        "animation": {"auto", "always", "never"},
        "labels": {"auto", "show", "hide"},
        "legendPosition": {"auto", "top", "bottom", "left", "right"},
    }
    for name, values in enums.items():
        if behavior[name] not in values:
            raise ProfileError(f"behavior.{name} is invalid")

    responsive = mapping(profile["responsive"], "responsive")
    exact_keys(responsive, {"breakpoints", "minHeight", "hideLegendBelow"}, {"breakpoints", "minHeight"}, "responsive")
    breakpoints = responsive["breakpoints"]
    if not isinstance(breakpoints, list) or not 1 <= len(breakpoints) <= 12:
        raise ProfileError("responsive.breakpoints is invalid")
    for index, value in enumerate(breakpoints):
        integer(value, 280, 4096, f"responsive.breakpoints[{index}]")
    if len(set(breakpoints)) != len(breakpoints):
        raise ProfileError("responsive.breakpoints contains duplicates")
    integer(responsive["minHeight"], 180, 1600, "responsive.minHeight")
    if "hideLegendBelow" in responsive:
        integer(responsive["hideLegendBelow"], 0, 4096, "responsive.hideLegendBelow")

    limits = mapping(profile["limits"], "limits")
    limit_keys = {"inlinePayloadWarningBytes", "pointsWarning", "maxPayloadBytes", "maxOptionDepth", "maxOptionKeys"}
    exact_keys(limits, limit_keys, limit_keys, "limits")
    for name, minimum, maximum in (("inlinePayloadWarningBytes", 1024, None), ("pointsWarning", 100, None), ("maxPayloadBytes", 4096, 16777216), ("maxOptionDepth", 4, 32), ("maxOptionKeys", 20, 10000)):
        integer(limits[name], minimum, maximum, f"limits.{name}")

    messages = mapping(profile["messages"], "messages")
    exact_keys(messages, {"empty", "error"}, {"empty", "error"}, "messages")
    for name in ("empty", "error"):
        if not isinstance(messages[name], str) or not 1 <= len(messages[name]) <= 1000:
            raise ProfileError(f"messages.{name} is invalid")

    def walk(value: Any, path: str = "$") -> None:
        if isinstance(value, dict):
            for key, child in value.items():
                if key in FORBIDDEN:
                    raise ProfileError(f"unsafe key at {path}.{key}")
                walk(child, f"{path}.{key}")
        elif isinstance(value, list):
            for index, child in enumerate(value):
                walk(child, f"{path}[{index}]")
    walk(profile)


def deep_merge(*sources: Any) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for source in sources:
        if not isinstance(source, dict):
            continue
        for key, value in source.items():
            if key in FORBIDDEN:
                raise ProfileError(f"unsafe profile key: {key}")
            if value is None:
                continue
            if isinstance(value, list):
                if value:
                    result[key] = json.loads(json.dumps(value))
            elif isinstance(value, dict):
                result[key] = deep_merge(result.get(key, {}), value)
            else:
                result[key] = value
    return result


def unique_colors(values: list[Any]) -> list[str]:
    result: list[str] = []
    for value in values:
        if isinstance(value, str) and COLOR.fullmatch(value) and value not in result:
            result.append(value)
    return result[:32]


def brand_tokens(profile: dict[str, Any]) -> dict[str, Any]:
    colors = profile.get("colors")
    if profile.get("schema_version") != "1.0" or not isinstance(colors, dict):
        raise ProfileError("Brand Report Kit profile is missing schema_version 1.0 or colors")
    primitive = colors.get("primitive", {})
    semantic = colors.get("semantic", {})
    screen = colors.get("screen", {})
    print_colors = colors.get("print", {})
    typography = profile.get("typography", {})
    families = typography.get("families", {}) if isinstance(typography, dict) else {}
    fallbacks = typography.get("fallbacks", []) if isinstance(typography, dict) else []
    responsive = profile.get("responsive", {})
    raw_breakpoints = responsive.get("breakpoints", {}) if isinstance(responsive, dict) else {}
    accessibility = profile.get("accessibility", {})
    layout = profile.get("layout", {})
    backgrounds = layout.get("backgrounds", {}) if isinstance(layout, dict) else {}
    palette = unique_colors([
        semantic.get("primary"),
        *(primitive.values() if isinstance(primitive, dict) else []),
        semantic.get("success"), semantic.get("warning"), semantic.get("danger"),
    ])
    if not palette:
        raise ProfileError("Brand Report Kit profile does not provide usable hexadecimal colors")
    return {
        "palette": palette,
        "fontFamily": ", ".join(str(value) for value in [families.get("body") or families.get("display"), *(fallbacks if isinstance(fallbacks, list) else [])] if value),
        "background": screen.get("page") or backgrounds.get("page") or "transparent",
        "surface": semantic.get("surface") or screen.get("surface") or "#FFFFFF",
        "textColor": semantic.get("text") or print_colors.get("text") or "#172033",
        "mutedColor": semantic.get("muted") or print_colors.get("muted") or "#526079",
        "lineColor": print_colors.get("line") or semantic.get("border") or "#AAB4C5",
        "borderColor": semantic.get("border") or print_colors.get("line") or "#D8DEEA",
        "breakpoints": sorted(value for value in (raw_breakpoints.values() if isinstance(raw_breakpoints, dict) else []) if isinstance(value, int) and not isinstance(value, bool)),
        "reducedMotion": accessibility.get("reduced_motion", True) if isinstance(accessibility, dict) else True,
        "minimumContrast": accessibility.get("minimum_contrast", 4.5) if isinstance(accessibility, dict) else 4.5,
    }


def safe_project_file(project_root: Path, configured: str) -> Path:
    candidate = project_root / configured
    if candidate.is_symlink():
        raise ProfileError(f"symbolic links are not allowed for profiles: {configured}")
    resolved_root = project_root.resolve(strict=True)
    resolved = candidate.resolve(strict=True)
    try:
        resolved.relative_to(resolved_root)
    except ValueError as exc:
        raise ProfileError(f"profile path leaves the project root: {configured}") from exc
    return resolved


def compile_profile(profile: dict[str, Any], project_root: Path) -> tuple[dict[str, Any], list[str]]:
    validate(profile)
    neutral = read_profile(NEUTRAL_PROFILE)
    validate(neutral)
    notices: list[str] = []
    provider_tokens: dict[str, Any] = {}
    visual_source = "neutral"
    configured = profile["visual"].get("brandReportKit", {}).get("profilePath", ".apex-brand-report-kit/brand-profile.json")
    if profile["visual"]["provider"] != "neutral":
        try:
            path = safe_project_file(project_root, configured)
            brand = json.loads(path.read_text(encoding="utf-8"))
            provider_tokens = brand_tokens(brand)
            visual_source = "oracle-apex-brand-report-kit"
            notices.append(f"Using Oracle APEX Brand Report Kit profile: {configured}")
        except (OSError, ValueError, ProfileError) as exc:
            if profile["visual"]["provider"] == "oracle-apex-brand-report-kit":
                raise ProfileError(f"The configured Oracle APEX Brand Report Kit profile is required and invalid or missing: {configured}. {exc}") from exc
            notices.append(f"Brand Report Kit profile not used ({exc}); using the neutral profile.")
    resolved = deep_merge(neutral["visual"]["overrides"], provider_tokens, profile["visual"]["overrides"])
    if profile["visual"]["overrides"]:
        visual_source = "project-overrides"
    compiled = deep_merge(neutral, profile)
    compiled["visual"] = deep_merge(profile["visual"], {"resolvedTokens": resolved, "source": visual_source})
    validate(compiled, compiled=True)
    return compiled, notices


def atomic_json(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    except BaseException:
        try:
            os.unlink(temporary)
        except FileNotFoundError:
            pass
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("profile", type=Path)
    parser.add_argument("--project-root", type=Path)
    parser.add_argument("--compile-output", type=Path)
    args = parser.parse_args()
    try:
        profile_path = args.profile.resolve(strict=True)
        project_root = (args.project_root or profile_path.parent).resolve(strict=True)
        compiled, notices = compile_profile(read_profile(profile_path), project_root)
        if args.compile_output:
            atomic_json(args.compile_output.resolve(), compiled)
        for notice in notices:
            print(f"NOTICE: {notice}")
        print(f"OK: profile 1.0 valid ({profile_path})")
        if args.compile_output:
            print(f"Compiled profile: {args.compile_output.resolve()}")
        return 0
    except (OSError, ValueError, ProfileError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
