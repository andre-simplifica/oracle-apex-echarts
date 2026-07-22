# Runtime and vendored files

Runtime-required files are the ECharts minified bundle, integration runtime,
scoped CSS, license/notice files, source metadata, and checksums embedded in the
plug-in export. `KEYS` and Node/npm tooling are maintenance-only.

`vendor/echarts/SOURCE.json` records the official tag/commit, Apache source
metadata, npm tarball/SRI, bundle path, SHA-256, and included notices. If any
upstream site disappears, the installed plug-in and tagged release retain every
runtime byte and license needed to render; only future maintenance checks are
affected.
