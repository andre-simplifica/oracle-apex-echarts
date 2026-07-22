# Security model

The server and browser both validate the declarative contract. The option
allowlist rejects JavaScript functions, executable callbacks, `eval`,
`renderItem`, `dataView`, free formatter strings, raw HTML, URLs and schemes,
prototype keys, unknown keys, excessive depth, excessive keys, and oversized
payloads. Tooltips use rich text and downloads use sanitized filenames.

Consumers remain responsible for authentication, server-side authorization,
organizational scope, bind variables, secure credentials, code review, and
deployment controls. A hidden region/button is never authorization.

Report vulnerabilities through GitHub private vulnerability reporting. Never
attach production data, cookies, tokens, wallets, private URLs, or authenticated
screenshots.
