---
name: oracle-apex-echarts
description: Build, install, integrate, review, secure, validate, and maintain self-contained Apache ECharts visualizations for Oracle APEX through the COM.SIMPLIFICA.APEX.ECHARTS region plug-in, PK_APEX_ECHARTS, Dynamic Content, or mixed pages. Use for ChartSpec, normalized SQL, OPTION_JSON, AJAX, project profiles, Oracle APEX Brand Report Kit interoperability, linked-repository skill updates, lifecycle bugs, accessibility, performance limits, installation compatibility, or Apache ECharts upstream upgrades.
---

# Oracle APEX ECharts

Use one neutral core and keep project identity, business SQL, filters, metrics,
authorization, page items, and domain packages in the consumer repository.

## Establish the contract

1. Read the consumer's `AGENTS.md`, local Oracle APEX/PLSQL standards, and environment rules.
2. Read `.oracle-apex-echarts/profile.yaml`; validate it with `scripts/validate_profile.py` when available.
3. Detect `.agents/skills/build-apex-brand-reports`, `.apex-brand-report-kit/brand-profile.json`, `.apex-brand-report-kit/report-kit.yaml`, and `.apex-brand-report-kit/project-standards.md`.
4. Confirm repository, branch, environment, APEX version, database version, application, page, region Static ID, parsing schema, authorization, items to submit, and domain package before changing code.
5. Inspect real objects and metadata. Never invent a table, column, item, package, process, permission, metric, or business rule.
6. Separate inspection, repository edits, database compilation, plug-in import, APEX page changes, and publication as authorization boundaries.

Read [architecture.md](references/architecture.md) before designing a new integration.

## Detect installation state

- **Compatible and installed:** confirm package, plug-in, runtime, ECharts, ChartSpec, profile, and `FILES_VERSION` against repository `compatibility.json` or packaged `assets/apex-distribution/compatibility.json`; then use them.
- **Absent:** list each missing component and provide the tagged artifacts and instructions. Install only with explicit authority and a confirmed non-production environment or approved target.
- **Incompatible:** stop. Show the installed and required versions, then propose a complete upgrade or rollback. Never mix components from different compatibility rows.

Read [installation-upgrade.md](references/installation-upgrade.md) for SQLcl, App Builder, linked skill installation, team onboarding, and guarded updates.

## Select the integration mode

- Use a **plug-in region** when SQL, authorization, refresh, loading, error, drill-down, or volume needs an independent lifecycle. Use `INLINE` for small stable payloads and `AJAX` for independent or larger refreshes.
- Use **Dynamic Content** when the chart belongs to the same narrative and snapshot as KPIs, cards, text, or tables. Call `PK_APEX_ECHARTS.FUNC_CHART_INLINE` or `FUNC_CHART_AJAX` from the domain package.
- Use **mixed mode** when both are justified. Add one approved plug-in region in `RUNTIME_ONLY` mode so assets load once; never emit a manual `<script src>`.

Read [apex-plugin.md](references/apex-plugin.md) for plug-in work. Read [dynamic-content.md](references/dynamic-content.md) for Dynamic Content or mixed pages.

## Build the chart

1. State the managerial question, grain, dimensions, measures, filters, volume, refresh behavior, and required fallback.
2. Select the chart type using [chart-selection.md](references/chart-selection.md). Honor an explicit task request before the profile, but do not silently use a misleading type.
3. Keep SQL and authorization in the domain package. Use binds and return normalized columns or one `OPTION_JSON` row.
4. Build ChartSpec 1.0 through `PK_APEX_ECHARTS`; provide an accessible description, empty message, safe error, and textual or tabular fallback when the chart is essential.
5. Apply precedence in this order: mandatory security/project rules, explicit current request, local profile, Brand Report Kit tokens, neutral profile.
6. Keep the browser runtime offline and self-contained. Use only plug-in files; never add CDN, npm, GitHub, remote JavaScript, iframe, or network fallback.

Read [project-profile.md](references/project-profile.md) before resolving defaults or visual tokens. Read [chart-spec.md](references/chart-spec.md) before producing ChartSpec, normalized SQL, or `OPTION_JSON`.

## Integrate with Brand Report Kit

Let Brand Report Kit own the document, header, filters, cards, tables, print, and CLOB composition. Let Oracle APEX ECharts own the chart. Compile only chart tokens from the brand profile; do not copy logos or business identity into the core. Keep essential content usable when the chart fails.

Read [brand-report-kit-integration.md](references/brand-report-kit-integration.md) whenever both skills or profiles are present. If the request uses the Brand Report Kit document, also read its linked `SKILL.md` and preserve its instructions.

## Enforce guardrails

- Reject `eval`, functions from data, free callbacks, `renderItem`, raw HTML, free URLs, `dataView`, arbitrary formatter strings, prototype keys, and unknown option keys.
- Keep tooltip `renderMode` as `richText`; use only registered formatter names.
- Authorize server-side; use binds; sanitize download names; dispatch fixed APEX events for drill-down.
- Escape HTML, attributes, and JSON embedded in `<script type="application/json">`.
- Cap depth, keys, payload, points, and submitted items. Treat warning and hard limits separately.
- Dispose charts, observers, requests, region interfaces, and handlers on refresh/removal. Abort and ignore stale AJAX responses.
- Preserve keyboard focus, ARIA, contrast, empty/error fallback, responsive sizing, and reduced motion.

Read [security-performance.md](references/security-performance.md) for every implementation or review.

## Validate before closing

1. Validate the profile and schemas; compile the profile deterministically.
2. Run lint, unit tests, build, checksums, ZIP integrity, plug-in export checks, license checks, and sensitive-data scan.
3. Exercise inline, AJAX, Dynamic Content, mixed mode, multiple charts, ten refreshes, dispose, hidden regions, tabs, dialogs, fullscreen, resize, slow/stale AJAX, empty/error, large payload, keyboard, and reduced motion.
4. Validate desktop, tablet, mobile, and narrow mobile. Confirm ECharts, runtime, and CSS each load once in Network.
5. Compile or import only when authorized. After installation, query `USER_ERRORS`, `USER_OBJECTS`, `APEX_APPL_PLUGINS`, and `APEX_APPL_PLUGIN_FILES`.
6. Report exactly what ran, what remained repository-only, and which APEX/database/browser combinations were not tested.

Read [validation.md](references/validation.md) for the evidence matrix.

## Maintain upstream safely

Run `npm run upstream:check` only to detect a stable release. Run `npm run upstream:update -- --version X.Y.Z --dry-run` before `--apply`. Require official npm SRI, matching Apache archive/checksum names, OpenPGP verification when a signature exists, official `KEYS`, bundle SHA-256, licenses, notices, source metadata, version synchronization, rebuilt artifacts, and all tests. Never commit, push, release, or import APEX from the updater.

Treat a new ECharts major as a separate branch and PR with breaking-change, allowlist, ChartSpec, formatter, security, lifecycle, POC, and rollback review. Read [upstream-maintenance.md](references/upstream-maintenance.md).
