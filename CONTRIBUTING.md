# Contributing

Keep changes neutral, small, synthetic, and auditable.

1. Open an issue for the reusable problem and affected layer.
2. Branch from `main`; do not include private consumer code or data.
3. Update canonical sources, generated assets, tests, compatibility, and
   `CHANGELOG.md` together when contracts change.
4. Use Node.js 24 LTS and run `npm ci && npm run validate:all`.
5. Open a pull request with the supplied template.

Never contribute customer queries, real identifiers, proprietary packages,
credentials, production URLs, authenticated screenshots, private branding, or
arbitrary executable ChartSpec behavior. Apache ECharts upgrades must follow
the documented provenance and major-version process.

Contributions are licensed under Apache-2.0.
