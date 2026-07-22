# Architecture

Maintain five ownership layers.

1. **Neutral core:** ChartSpec validation, option allowlist, serialization, AJAX handling, lifecycle registry, accessibility, scoped CSS, and the browser runtime.
2. **Oracle APEX plug-in:** a thin adapter for declarative attributes, render/AJAX callbacks, embedded files, normal regions, and `RUNTIME_ONLY`.
3. **Dynamic Content:** a project-owned domain package queries data, checks authorization, and calls the public `PK_APEX_ECHARTS` API. It never embeds a bundle, CDN, remote script, callback, or serializer.
4. **Project profile:** locale, timezone, visual tokens, chart preferences, integration defaults, download policy, responsive settings, messages, and limits.
5. **Project domain:** tables, queries, binds, metrics, permissions, APEX items, processes, and business packages.

The browser loads `echarts-<version>.min.js`, `oracle-apex-echarts.js`, and
`oracle-apex-echarts.css` from plug-in files. `apex_javascript.add_library` keys
deduplicate JavaScript. CSS is scoped to `.oracle-apex-echarts`. A page-wide
registry owns each chart, `ResizeObserver`, AJAX request, and APEX region
interface. Refresh and DOM removal dispose all owned resources.

Do not require Node.js, npm, Python, Git, GitHub, an internet connection, or a
frontend server after the plug-in is installed. Maintenance tooling may use
those dependencies outside the APEX runtime.

Preserve the plug-in internal name `COM.SIMPLIFICA.APEX.ECHARTS` for upgrades.
Use `Apache ECharts for Oracle APEX` as the display name. The technical internal
name does not impose visual identity on consumers.
