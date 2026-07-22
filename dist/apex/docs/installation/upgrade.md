# Upgrade

Upgrade package, plug-in, browser runtime, ECharts bundle, ChartSpec, profile,
and `FILES_VERSION` only in combinations listed in `compatibility.json`.

Run the new installer in a confirmed environment. It blocks downgrade and
partial/mismatched existing states. Keep the previous release and checksums for
rollback. After import, run the validator and all affected page/runtime tests.
Never copy only `plugin.sql` or only a package body from another release.
