# Validation status

Release gates cover schemas, profiles, Brand Report Kit mapping, precedence,
chart selection, download policies, ChartSpec, allowlists, lifecycle, stale
AJAX, ten refreshes, multiple charts, hidden regions, resize, empty/error,
payload limits, deterministic builds, ZIPs, checksums, licenses, plug-in files,
skill structure, linked updater behavior, and sensitive-data scanning.

Repository inspection confirmed the public APEX 24.2.10 metadata views used by
the installer. No package was compiled and no plug-in was imported into any
database during the first public release.

Still required in an authorized non-production APEX environment: compilation,
plug-in import, Page Designer configuration, authenticated runtime checks,
desktop/tablet/mobile/narrow visual inspection, Network asset deduplication,
tabs, dialogs, fullscreen, keyboard, download authorization, and browser matrix.
Do not treat repository tests as that runtime evidence.
