# Apache ECharts upstream maintenance

Use only the official changelog/repository, `apache/echarts` releases, Apache
distribution, and official npm `echarts` package.

`npm run upstream:check` reports the current and latest stable version without
changing files. `npm run upstream:update -- --version X.Y.Z --dry-run` prepares
and verifies a candidate; `--apply` updates the working tree but never commits,
pushes, releases, or imports APEX.

Require an explicit stable version. Reject RC, beta, alpha, dev, and nightly.
Work in a temporary directory. Verify npm SHA-512 SRI and extract the exact
bundle. For an Apache source archive, require the archive name, checksum entry
name, signature target, tag, and version to agree. Verify SHA-512 and the
OpenPGP signature with official `KEYS` when published. Reject any mismatch.

Record tag, commit, source archive, npm tarball, SRI, bundle SHA-256, licenses,
notices, and `SOURCE.json`. Update asset names, compatibility versions,
`FILES_VERSION`, package/plugin/runtime constants, plug-in export, distribution,
and checksums as one change. Run every test and produce a difference report.

For a new major, use a dedicated branch and PR. Review upstream breaking
changes, option/series allowlists, ChartSpec, formatters, security, lifecycle,
POC evidence, compatibility, and rollback. Never merge or publish it
automatically.
