# Validation evidence

Repository gates:

- profile valid/invalid, neutral fallback, Brand Report Kit mapping, overrides,
  precedence, preferred bar versus line, and all download policies;
- valid/invalid ChartSpec, normalized SQL contract, one-row `OPTION_JSON`,
  inline/AJAX plug-in, Dynamic Content, and mixed examples;
- multiple charts, one asset load, ten refreshes, dispose, hidden region, tabs,
  dialogs, fullscreen, resize, slow/stale AJAX, large payload, and many series;
- no callbacks, HTML, URLs, functions, `dataView`, `renderItem`, or prototype
  pollution; sanitized empty/error behavior;
- deterministic build, current generated files, checksums, ZIP integrity,
  plug-in embedded files, skill validation, license evidence, and sensitive scan.

Runtime gates in an authorized APEX environment:

1. Confirm package and body `VALID` with no `USER_ERRORS`.
2. Confirm plug-in version, `FILES_VERSION`, and all embedded files.
3. Test desktop, tablet, mobile, narrow mobile, keyboard, reduced motion, tabs,
   dialogs, fullscreen, resize, empty/error, and authorized download.
4. Perform ten refreshes and inspect Network/console for one asset load, stale
   response suppression, zero accumulated handlers, and disposed instances.
5. Confirm server authorization, bind usage, SQL scope, and table/text fallback.

Forward-test these requests independently: plug-in bar region; Dynamic Content
with KPIs and chart; Brand Report Kit composition; neutral fallback; bar plus
download never; missing plug-in diagnosis; upstream version check; and safe new
major preparation without publication.

Never claim APEX/database/browser runtime validation when only repository tests
ran. List every untested combination explicitly.
