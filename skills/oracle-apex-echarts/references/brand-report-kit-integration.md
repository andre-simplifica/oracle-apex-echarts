# Oracle APEX Brand Report Kit integration

When both skills are present, preserve ownership:

- Brand Report Kit owns the document, header, filters, KPI cards, tables,
  printing, PDF behavior, and CLOB composition.
- Oracle APEX ECharts owns ChartSpec, chart rendering, lifecycle, AJAX, and
  chart accessibility.
- The consumer domain package owns SQL, metrics, binds, filters, and
  authorization.

Map deterministically from `brand-profile.json`:

- palette: `colors.semantic.primary`, then hexadecimal values from
  `colors.primitive`, then semantic success, warning, and danger;
- font: `typography.families.body` (or display) plus
  `typography.fallbacks`;
- background/surface: `colors.screen.page` (or
  `layout.backgrounds.page`) and `colors.semantic.surface` (or
  `colors.screen.surface`);
- text/muted/line/border: semantic values first, then matching
  `colors.print` fallbacks;
- breakpoints: sorted integer values from `responsive.breakpoints`;
- motion/contrast: `accessibility.reduced_motion` and
  `accessibility.minimum_contrast`.

Discard invalid/non-hex series colors and duplicates. Do not copy logos,
private assets, component HTML, or company identity into the neutral core.

Use `.apex-brand-report-kit/brand-profile.json` by default. For an explicit
provider, missing/invalid input is an error. For `auto`, emit a notice and use
the neutral profile when absent.

Treat an explicit task request to use Brand Report Kit as required for that
task: set or require `visual.provider: oracle-apex-brand-report-kit` instead of
silently falling back. Use `auto` only when the task or project profile allows
the neutral fallback. When the linked Brand Report Kit skill is present and the
document is in scope, read its `SKILL.md` before editing the report.

Embed the chart through `PK_APEX_ECHARTS` in Dynamic Content. Load files once by
an approved `RUNTIME_ONLY` plug-in region. Keep the report useful through
semantic text/table fallbacks when JavaScript, ECharts, or the chart fails.
