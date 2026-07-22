# Architecture and ownership

The neutral core owns validation, security, ChartSpec, serialization, AJAX,
lifecycle, accessibility, runtime JavaScript, and scoped CSS. The plug-in is a
thin APEX adapter. Dynamic Content uses the same PL/SQL API without bundling
JavaScript. The project profile owns visual/default behavior. Consumer domain
packages own SQL, metrics, filters, binds, and authorization.

The plug-in internal name remains `COM.SIMPLIFICA.APEX.ECHARTS` so existing
installations upgrade one component. The display name and runtime identity are
neutral. `apex_javascript.add_library` keys deduplicate assets and the page
registry prevents duplicate chart instances and accumulated handlers.
