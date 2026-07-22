# Page Designer

For an independent chart, create an **Apache ECharts for Oracle APEX** region,
assign a stable Static ID, select data contract/load mode/preset, provide SQL,
Items to Submit, server authorization, accessible description, empty/error
messages, and approved download behavior.

For Dynamic Content, keep the region source as one domain-package call. Add one
approved plug-in region in `RUNTIME_ONLY` mode to load the embedded files. Do
not add `<script src>` or duplicate the ECharts bundle in the CLOB.

After changes, validate runtime through Page Designer and the application. Test
refresh, empty/error, filters, hidden/tab/dialog presentation, fullscreen,
resize, keyboard, reduced motion, narrow mobile, and asset deduplication.
