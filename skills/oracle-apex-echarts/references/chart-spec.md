# ChartSpec 1.0

Validate against `assets/schemas/chart-spec.schema.json` on the server and again
in the browser after safe defaults are applied.

```json
{
  "schemaVersion": "1.0",
  "id": "sales_by_month",
  "requiredRuntime": ">=1.0.0 <2.0.0",
  "preset": "bar_vertical",
  "accessibility": {
    "description": "Monthly synthetic sales comparison.",
    "fallbackText": "Use the accompanying table.",
    "emptyText": "No data is available."
  },
  "data": {
    "mode": "inline",
    "contract": "option",
    "option": {
      "xAxis": {"type": "category"},
      "yAxis": {"type": "value"},
      "series": [{"type": "bar", "data": [["Jan", 18], ["Feb", 24]]}]
    }
  }
}
```

For normalized plug-in SQL, return `X_VALUE`, `Y_VALUE`, and `SERIES_NAME`;
optionally return `SERIES_TYPE`, `ITEM_LABEL`, `ITEM_COLOR`, and `SORT_ORDER`.
Use binds. For `OPTION_JSON`, return exactly one row and one `OPTION_JSON` CLOB.

Use only allowlisted option keys and series types. Formatters are registered
names such as `integer`, `decimal_2`, `percent`, `currency_brl`, `short_number`,
`date_br`, and `datetime_br`; never pass a formatter function or source text.

AJAX responses must contain one inline ChartSpec, a fixed chart map, or a fixed
group map. Keep the request process/plug-in identifier server-defined. Ignore
client attempts to choose procedures, SQL, URLs, or executable callbacks.
