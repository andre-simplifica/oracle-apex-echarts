# Mixed page

1. Add one plug-in region in `RUNTIME_ONLY` mode.
2. Add independent plug-in regions for queries that own their refresh lifecycle.
3. Add a Dynamic Content region that calls the synthetic domain package.
4. Give every region and ChartSpec a unique stable ID.
5. Apply one compiled project profile in plug-in Component Settings.
6. Verify one ECharts file, one runtime file, and one CSS file in Network after ten refreshes.
7. Confirm every chart uses the one shared registry and that disposed regions leave no instance or handler behind.
