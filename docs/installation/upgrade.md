# Upgrade

Upgrade package, plug-in, browser runtime, ECharts bundle, ChartSpec, profile,
and `FILES_VERSION` only in combinations listed in `compatibility.json`.

Run the new installer in a confirmed environment. It blocks downgrade and
partial/mismatched existing states. Keep the previous release and checksums for
rollback. After import, run the validator and all affected page/runtime tests.
Never copy only `plugin.sql` or only a package body from another release.

`PK_APEX_ECHARTS` belongs to the parsing schema, while the plug-in belongs to
each application. When several applications share the schema, run `install.sql`
for the first one. For each other application, import that release's
`plugin.sql` in Shared Components and run `validate-installation.sql`: the
installer stops with an incompatible state once the shared package is already at
the target version.

Update a linked skill with the consumer manager, not the scaffold, which refuses
to overwrite an existing installation:
`manage_oracle_apex_echarts.py update --ref <tag> --dry-run`, then the same
command without `--dry-run`. The lock then tracks the new tag.
