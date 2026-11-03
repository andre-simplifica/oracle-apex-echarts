# Changelog

All notable changes use [Semantic Versioning](https://semver.org/).

## 1.1.0 - 2026-11-03

- Format numbers on value axes, tooltips, and bar or line labels with the
  project locale, including the `[x, y]` items that `PK_APEX_ECHARTS` presets
  generate; ECharts itself writes `1,299` on axes and tooltips and the raw
  `1299` on labels in every locale.
- Resolve the locale from the profile, then the page language, then `en-US`,
  using only valid tags that `Intl` supports. In 1.0.x an invalid profile locale
  made tooltips with a registered formatter throw.
- Keep text tooltip values as they arrive instead of reading them as numbers,
  and keep ECharts dates in tooltips that can receive a time value (a time axis
  without a value axis, or `encode.label`).
- Infer missing axis types like ECharts (category with `data`, value without).
- Keep axis labels level on charts up to 767 px wide instead of rotating them
  30 degrees, and hide value-axis labels that would overlap.
- Keep the chart's own `grid` at every width; the plug-in grid now applies only
  to charts without one, so value labels beside bars are no longer clipped.
- Read the APEX parsing schema from `APEX_APPLICATIONS.OWNER` in the installer
  preflight (#1).
- Move project, skill, plug-in, `PK_APEX_ECHARTS`, and runtime to 1.1.0 and the
  plug-in `FILES_VERSION` to 2, so browsers download the new runtime; the
  consumer scaffold now tracks `v1.1.0` by default.

## 1.0.1 - 2026-07-22

- Resolve annotated release tags to their commits in the linked-skill updater.
- Normalize ZIP creation to UTC so release artifacts are byte-identical on macOS and Linux.
- Keep plug-in, package, runtime, ChartSpec, and profile contracts unchanged.

## 1.0.0 - 2026-07-22

- Publish the neutral Oracle APEX region plug-in and `PK_APEX_ECHARTS` API.
- Vendor Apache ECharts 6.1.0 with provenance, licenses, and checksums.
- Add ChartSpec 1.0, project profile 1.0, Brand Report Kit mapping, and neutral fallback.
- Add linked-repository skill installation, guarded updater, CI, and upstream maintenance tooling.
