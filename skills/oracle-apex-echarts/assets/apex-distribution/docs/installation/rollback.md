# Rollback

Do not mix package, plug-in, runtime, ECharts, ChartSpec, or profile versions.

1. Stop if `validate-installation.sql` reports a mismatch.
2. Obtain the previously installed tagged release and verify its `SHA256SUMS`.
3. In the same confirmed workspace, application, and parsing schema, run that
   release's `install.sql` only after an explicit downgrade/rollback approval.
4. If the installer blocks the downgrade, import the previous `plugin.sql` and
   compile its matching package manually during the approved rollback window.
5. Run the previous release's post-installation validator and test the affected
   pages. Do not delete the plug-in or package as a shortcut.

The project intentionally ships no automatic destructive uninstall script.
