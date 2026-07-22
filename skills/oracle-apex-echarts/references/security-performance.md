# Security, performance, and accessibility

Apply every item:

- Validate ChartSpec schema and safe option allowlist in PL/SQL and JavaScript.
- Reject functions, `eval`, free callbacks/formatters, `renderItem`, `dataView`,
  raw HTML, URLs, schemes, prototype keys, and unknown keys.
- Force rich-text tooltips and sanitize download names.
- Escape HTML, attributes, and JSON script text.
- Use bind variables and server-side authorization; never trust hidden UI.
- Keep fixed AJAX process identifiers and allowlisted Items to Submit.
- Enforce max depth, keys, payload, points, and submitted item counts.
- Warn before inline/payload thresholds; reject beyond the hard payload limit.
- Abort old requests and compare revisions before rendering responses.
- Dispose charts, observers, requests, events, and APEX region interfaces.
- Deduplicate libraries and avoid bundle content in CLOBs.
- Provide ARIA description, keyboard focus, reduced motion, contrast, empty and
  sanitized error states, and a text/table fallback for essential meaning.

Never place credentials, cookies, tokens, private URLs, production data,
customer/collaborator names, real application/workspace/schema IDs, or personal
paths in source, examples, screenshots, logs, ZIPs, or releases.
