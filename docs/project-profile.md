# Project profile 1.0

Validate `.oracle-apex-echarts/profile.yaml` against
`schemas/project-profile.schema.json`. The profile includes project locale and
timezone; visual provider/tokens; preferred and allowed chart types;
integration mode; renderer, animation, labels, legend, and download policy;
breakpoints and height; warning/hard limits; and empty/error messages.

Precedence is security/project rules, explicit task, local profile, Brand
Report Kit tokens, then neutral profile. The compiler outputs only chart tokens
from Brand Report Kit and never copies logos or document identity.

Use `never`, `allow`, or `always` for download. Server-side authorization and an
explicit denial always win. Use `prefer` for a soft chart preference and
`require` to block silent substitution when the preferred type is unsuitable.
