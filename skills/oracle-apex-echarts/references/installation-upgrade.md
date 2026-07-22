# Installation, upgrade, and team distribution

Prefer the tagged public release at
`https://github.com/andre-simplifica/oracle-apex-echarts/releases/tag/v1.0.0`
and verify its external `SHA256SUMS`. In a linked skill, the self-contained
repository-only distribution is `assets/apex-distribution/`.

If “plug-in” is ambiguous, distinguish the Oracle APEX plug-in from the agent
skill before reporting state. When database access is authorized for
inspection, run the strictly read-only audit first:

```text
sql -S -L -name <saved-dev-connection> @audit-installation.sql <application_id>
```

Report unknown components as unknown; absence of the APEX plug-in alone does
not prove that the package, profile, or linked skill is absent.

For SQLcl, connect to the confirmed parsing schema and run:

```text
sql -S -L -name <saved-dev-connection> @install.sql <application_id>
sql -S -L -name <saved-dev-connection> @validate-installation.sql <application_id>
```

The installer confirms workspace, application, parsing schema, installed
versions, package status, plug-in, and embedded files. It blocks incomplete
states and downgrade. It creates no pages, regions, tables, jobs, or data.
The audit command does not authorize these write operations.

For App Builder, compile the matching package specification/body in the parsing
schema, then use **Shared Components > Plug-ins > Import** for `plugin.sql` and
run post-install validation. Never trial-import into production.

For rollback, read
`assets/apex-distribution/docs/installation/rollback.md`, obtain the previously
installed tagged release, verify its checksums, and treat package compilation
and plug-in import as separately authorized operations.

For teams, keep the managed skill at
`.agents/skills/oracle-apex-echarts/`. Scaffold the local profile, lock,
onboarding file, and `Util/scripts/manage_oracle_apex_echarts.py`. Do not use a
Git submodule by default and never overwrite local profile, domain packages,
queries, authorization, APEX exports, or project rules.

Update flow: `status`, `check`, `update --dry-run`, review diff, update on a
branch, open a consumer PR, merge, `git pull`, then start a new Codex task. The
updater refuses symlinks and modified managed files and uses atomic replacement
with rollback.

If discovery fails, confirm workspace/branch and exact skill path, inspect
`SKILL.md`, start a new Codex task, then restart Codex if needed. Codex Desktop,
CLI, IDE, Cloud, Claude, and generic agents can fall back to reading `SKILL.md`
explicitly. Global installation is a personal alternative, not the team norm.
