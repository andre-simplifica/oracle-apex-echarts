# Upstream process

The scheduled workflow checks the latest stable npm release and opens or updates
one deduplicated issue. It never changes the bundle. The local updater works in
a temporary directory, rejects prereleases, verifies official sources, and
applies a candidate only after `--dry-run` review.

New majors require a dedicated branch containing `echarts-<major>`, a supplied
major-review evidence file, breaking-change and allowlist review, ChartSpec and
formatter review, security/lifecycle review, non-production POC, and rollback.
The updater never performs Git publication or an APEX import.
