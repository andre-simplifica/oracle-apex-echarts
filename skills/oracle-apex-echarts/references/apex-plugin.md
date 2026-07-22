# Oracle APEX plug-in

Use the stable internal name `COM.SIMPLIFICA.APEX.ECHARTS` and display name
`Apache ECharts for Oracle APEX`.

In Page Designer:

1. Create a region of the plug-in type and assign a stable Static ID.
2. Set Mode to `CHART` or `RUNTIME_ONLY`.
3. For `CHART`, choose `NORMALIZED_SQL` or `OPTION_JSON` and `INLINE` or `AJAX`.
4. Use a chart preset allowed by the project profile.
5. Set Items to Submit, region authorization, accessible description, empty
   message, safe error, and any explicitly authorized download.
6. Keep custom overrides to the safe ChartSpec subset.

The 25 component attributes, in Page Designer order, are: Mode, Data Contract,
Load Mode, Preset, Theme, Renderer, Minimum Height, Animation, Animation
Duration, Legend, Legend Position, Labels, Tooltip, Zoom, Save as Image,
Restore, Download File Name, ARIA, Accessible Description, Decal, Named
Formatter, Refresh Strategy, Empty Message, Error Message, and ChartSpec
Overrides JSON. Confirm their actual values in the plug-in metadata; never
guess item names or identifiers.

Use `INLINE` for small payloads that should render with the page. Use `AJAX` for
independent refresh, slow queries, or larger payloads. Keep SQL authorization in
the query/domain layer. The plug-in handles loading, stale requests, errors,
refresh, resize, and dispose.

Use `RUNTIME_ONLY` once on a page that has only Dynamic Content charts. It loads
embedded assets and configuration but renders no chart and creates no page.

Do not add a global region automatically. Do not import a full application.
After manual App Builder import, separately compile the matching package in the
application parsing schema and run the post-installation validator.
