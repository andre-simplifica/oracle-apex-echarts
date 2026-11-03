# Project profile 1.0

Validate `.oracle-apex-echarts/profile.yaml` against
`schemas/project-profile.schema.json`. The profile includes project locale and
timezone; visual provider/tokens; preferred and allowed chart types;
integration mode; renderer, animation, labels, legend, and download policy;
breakpoints and height; warning/hard limits; and empty/error messages.

The browser runtime formats numbers on value axes, tooltips, and bar or line
labels with the profile locale. Labels of `[x, y]` items show the value-axis
dimension; series with `encode` or a dataset keep the ECharts label. When the
configured profile has no valid supported locale, the runtime uses the page
language that Oracle APEX writes to `<html lang>`, and then `en-US`. Text
values, such as a label column already formatted by the server, are shown as
they arrive. Tooltips that can receive a time value (a time axis without a
value axis, or `encode.label`) keep the ECharts date formatting.

Precedence is security/project rules, explicit task, local profile, Brand
Report Kit tokens, then neutral profile. The compiler outputs only chart tokens
from Brand Report Kit and never copies logos or document identity.

Use `never`, `allow`, or `always` for download. Server-side authorization and an
explicit denial always win. Use `prefer` for a soft chart preference and
`require` to block silent substitution when the preferred type is unsuitable.
