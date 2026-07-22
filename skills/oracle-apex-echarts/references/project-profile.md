# Project profile

The canonical consumer path is `.oracle-apex-echarts/profile.yaml`; validate it
against `assets/schemas/project-profile.schema.json`.

If the project has no local profile, copy
`assets/neutral-profile/profile.yaml` to the canonical consumer path so the
decision is reviewable and versioned. Direct neutral fallback is safe for
inspection, but a team integration should persist the local copy.

Apply precedence from highest to lowest:

1. mandatory security and project instructions;
2. explicit current task request;
3. local project profile;
4. Oracle APEX Brand Report Kit tokens;
5. bundled neutral profile.

`preferencePolicy: prefer` uses the preferred chart only when it answers the
managerial question well. `require` never substitutes silently; explain why the
required type is unsuitable and request an explicit choice.

`downloadPolicy: never` always disables download. `allow` keeps download off
unless the server-produced chart explicitly authorizes it. `always` enables it
by default, but an explicit server-side denial or security rule wins.

`defaultMode` semantics:

- `plugin`: prefer an independent plug-in region.
- `dynamic-content`: prefer CLOB composition with a `RUNTIME_ONLY` loader.
- `auto`: decide from page architecture and lifecycle ownership.
- `mixed`: permit both on one page with one runtime registry.

For `visual.provider: oracle-apex-brand-report-kit`, stop when the configured
profile is missing or invalid. For `auto`, try the configured/default known
path and emit a notice before using the neutral fallback.

Validate and compile the profile to deterministic JSON before pasting it into
plug-in Component Settings:

```text
python3 .agents/skills/oracle-apex-echarts/scripts/validate_profile.py \
  .oracle-apex-echarts/profile.yaml \
  --project-root . \
  --compile-output .oracle-apex-echarts/compiled-profile.json
```

The script uses only the Python standard library, enforces project-bound paths,
rejects symlinks, resolves Brand Report Kit or neutral tokens, and writes the
compiled JSON atomically. Never let the profile enable executable JavaScript,
HTML, URLs, free formatters, callbacks, or forbidden ChartSpec keys.
