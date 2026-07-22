# Oracle APEX ECharts

[![CI](https://github.com/andre-simplifica/oracle-apex-echarts/actions/workflows/ci.yml/badge.svg)](https://github.com/andre-simplifica/oracle-apex-echarts/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/andre-simplifica/oracle-apex-echarts)](https://github.com/andre-simplifica/oracle-apex-echarts/releases)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

A public, reusable, self-contained Apache ECharts integration for Oracle APEX.
It includes a region plug-in, `PK_APEX_ECHARTS`, an offline browser runtime,
ChartSpec 1.0, a per-project profile, an agent skill, guarded team updates, and
upstream maintenance tooling.

The installed APEX runtime needs no CDN, npm, GitHub, internet connection,
frontend server, iframe, Python, or Node.js. Apache ECharts 6.1.0 and every
required runtime file are embedded in `plugin.sql`.

Read this document in [Português do Brasil](README.pt-BR.md).

> Oracle and Oracle APEX are trademarks or registered trademarks of Oracle
> Corporation and/or its affiliates. Apache, Apache ECharts, and ECharts are
> trademarks of The Apache Software Foundation. This independent project is not
> affiliated with or endorsed by Oracle Corporation or The Apache Software
> Foundation.

## Release contract

| Component | Version |
| --- | --- |
| Oracle APEX ECharts | 1.0.1 |
| Apache ECharts | 6.1.0 |
| Plug-in | 1.0.0 |
| `PK_APEX_ECHARTS` | 1.0.0 |
| Browser runtime | 1.0.0 |
| ChartSpec | 1.0 |
| Project profile | 1.0 |

The exact platform and browser claims live in [`compatibility.json`](compatibility.json).
Repository validation targets Oracle APEX 24.2 and Oracle Database 26ai. The
first public release was not imported into a live APEX application; see
[validation](docs/validation.md) before production adoption.

## Choose an integration

- Use a **plug-in region** when SQL, authorization, refresh, loading, error,
  drill-down, or volume has an independent lifecycle.
- Use **Dynamic Content** when the chart belongs to one CLOB narrative with
  KPIs, text, cards, or tables. The domain package calls `PK_APEX_ECHARTS`.
- Use **mixed mode** when both are justified. A single `RUNTIME_ONLY` plug-in
  region loads files for Dynamic Content charts; assets remain deduplicated.

Business SQL, binds, metrics, permissions, APEX items, and domain packages stay
in the consumer. The public core never owns them.

## Install the skill in a consumer repository

Team installations belong in `.agents/skills/oracle-apex-echarts/`; a Git
submodule is not the default. From a repository checkout, run:

```bash
python3 skills/oracle-apex-echarts/scripts/scaffold_consumer.py \
  --project /path/to/consumer \
  --commit <release-commit-sha> \
  --ref v1.0.1

python3 skills/oracle-apex-echarts/scripts/scaffold_consumer.py \
  --project /path/to/consumer \
  --commit <release-commit-sha> \
  --ref v1.0.1 \
  --apply
```

When using the release skill ZIP, the equivalent script is
`oracle-apex-echarts/scripts/scaffold_consumer.py`. The scaffold creates the
managed skill, `.oracle-apex-echarts/profile.yaml`, an
upstream lock, team onboarding, and
`Util/scripts/manage_oracle_apex_echarts.py`. It refuses overwrites and
symlinks. Invoke the skill as `$oracle-apex-echarts` in a new Codex task.

## Configure the project profile

Edit `.oracle-apex-echarts/profile.yaml` and validate/compile it:

```bash
npm ci
npm run validate:profile -- --profile /path/to/consumer/.oracle-apex-echarts/profile.yaml \
  --project-root /path/to/consumer \
  --output /tmp/oracle-apex-echarts-profile.json
```

`visual.provider: auto` uses a known Oracle APEX Brand Report Kit profile when
available, otherwise emits a notice and uses the neutral profile. An explicit
`oracle-apex-brand-report-kit` provider fails when its profile is missing or
invalid. Security cannot be relaxed by the profile.

See [project profile](docs/project-profile.md) and the complete
[synthetic example](examples/neutral-profile/profile.yaml).

## Install the Oracle APEX distribution

Verify `SHA256SUMS`, connect to the confirmed parsing schema, and pass the
application ID explicitly:

```text
sql -S -L -name <saved-dev-connection> @audit-installation.sql <application_id>
sql -S -L -name <saved-dev-connection> @install.sql <application_id>
sql -S -L -name <saved-dev-connection> @validate-installation.sql <application_id>
```

The first command is strictly read-only and reports absent, compatible, or
partial/incompatible state. The installer then confirms workspace, application, parsing schema, installed
versions, `USER_ERRORS`, `USER_OBJECTS`, plug-in metadata, and embedded files.
It blocks downgrade and incomplete states. It creates no pages, regions,
tables, jobs, or application data.

For App Builder, compile the matching package specification/body in the parsing
schema, then use **Shared Components > Plug-ins > Import** for `plugin.sql` and
run the post-installation validator. No global region is added automatically.

Read the [manual installation](docs/installation/manual.md),
[SQLcl procedure](docs/installation/sqlcl.md),
[Page Designer setup](docs/installation/page-designer.md), and
[rollback procedure](docs/installation/rollback.md).

## Maintain a linked copy

From the consumer repository:

```bash
python3 Util/scripts/manage_oracle_apex_echarts.py status
python3 Util/scripts/manage_oracle_apex_echarts.py check
python3 Util/scripts/manage_oracle_apex_echarts.py update --dry-run
python3 Util/scripts/manage_oracle_apex_echarts.py update
```

Review the dry-run diff, update on a branch, and merge through a consumer pull
request. The updater touches only `.agents/skills/oracle-apex-echarts/` and its
lock; it refuses locally modified managed files and preserves every project
profile, rule, query, authorization, domain package, and APEX export.

## Maintain Apache ECharts

```bash
npm run upstream:check
npm run upstream:update -- --version 6.2.0 --dry-run
npm run upstream:update -- --version 6.2.0 --apply
```

The updater accepts only an explicit stable version, verifies npm SHA-512 SRI,
requires matching Apache archive/checksum names, verifies OpenPGP when a
signature is published, uses official `KEYS`, records tag/commit/source/bundle,
updates licenses and checksums, rebuilds everything, and runs all tests. It
never commits, pushes, releases, or imports APEX. New ECharts majors require a
dedicated branch and review evidence.

The Apache 6.1.0 source checksum payload currently names an RC archive; this
project records and rejects that source-archive inconsistency. The shipped
runtime bundle is byte-for-byte identical to the official npm package and is
verified by SRI and SHA-256. See [`SOURCE.json`](vendor/echarts/SOURCE.json).

## Develop and validate

Use Node.js 24 LTS and npm 11:

```bash
npm ci
npm run validate:all
```

The gate runs syntax/lint checks, schemas, skill structure, profile resolution,
ChartSpec/security/lifecycle tests, deterministic builds, ZIP/checksum checks,
license/provenance checks, and a sensitive-data scan. CI also checks that
generated artifacts are current.

## Repository map

```text
skills/oracle-apex-echarts/  reusable agent skill
src/js/                      offline integration runtime
src/css/                     scoped chart CSS
src/plsql/                   PK_APEX_ECHARTS specification and body
src/plugin/                  declarative plug-in metadata
schemas/                     ChartSpec, profile, and compatibility schemas
vendor/echarts/              vendored bundle, licenses, KEYS, provenance
examples/                    synthetic plug-in, CLOB, mixed, and chart examples
adapters/                    Codex, Claude, generic, and Brand Report Kit guidance
scripts/                     build, validation, updates, and linked-copy tooling
dist/release/                validated release payload assembled by CI
```

## License

Project code is Apache-2.0. Vendored Apache ECharts and subcomponent notices are
preserved under [`vendor/echarts`](vendor/echarts). See [LICENSE](LICENSE) and
[NOTICE](NOTICE).
