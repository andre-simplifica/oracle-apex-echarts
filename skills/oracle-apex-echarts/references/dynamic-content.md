# Dynamic Content and mixed pages

Keep the Dynamic Content source thin:

```plsql
return pk_dashboard.func_synthetic_report(
  p_period => :P10_PERIOD
);
```

Inside the confirmed domain package, compose KPIs, text, tables, and charts.
Build chart markup only through:

```plsql
l_html := l_html || pk_apex_echarts.func_chart_inline(
  p_id                     => 'sales_by_month',
  p_option_json            => l_option_json,
  p_accessible_description => 'Synthetic sales by month.',
  p_fallback_text          => 'Use the table below.'
);
```

`FUNC_CHART_INLINE` accepts a safe ECharts option object in `p_option_json` and
builds plus validates ChartSpec 1.0 internally. Use `FUNC_CHART` only when the
caller already owns a complete ChartSpec 1.0. Do not pass a complete ChartSpec
as `p_option_json`.

Use `FUNC_CHART_AJAX` only with a fixed, authorized APEX process Static ID and
known Items to Submit. The domain package owns SQL, filters, metrics, scope, and
authorization. Provide a table/text fallback when the chart is essential.

Detect and reuse an approved `RUNTIME_ONLY` region before adding one; a page
needs at most one runtime loader. Never put
the ECharts bundle, `<script src>`, CDN URL, free callback, or duplicate
serializer in the returned CLOB.

Keep KPI cards as semantic HTML owned by the report/domain layer. Preserve
their labels and values independently of the chart and include a semantic
text/table fallback whenever the chart carries essential information.

On mixed pages, plug-in and Dynamic Content charts share the profile, runtime,
registry, asset keys, and lifecycle. Verify one load per file and no duplicate
IDs or accumulated handlers after ten refreshes.
