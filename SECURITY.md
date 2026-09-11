# Security

## Reporting

Report a suspected vulnerability privately to the repository owners — open a
GitHub security advisory on this repository, or contact the maintainers
directly. Do not open a public issue.

## What this server handles

A Domustudio API key per archive, read from `DOMUSTUDIO_ARCHIVES` in the
environment of the process the MCP client launches. One key grants read access
to one archive's condomini, persone and fornitori — names, addresses, tax codes,
contact details and bank details of real people. Treat a leaked key as a
personal-data incident, not merely a service credential.

## Rules this repository enforces

- **`.env` is gitignored and must stay that way.** Real keys live there and
  nowhere else in the tree. `.env.example` carries placeholders only.
- **Keys never reach a tool result.** An authentication failure names the archive
  and the header, never the value.
- **The test suite needs no credentials.** `test/live.test.ts` skips unless
  `DOMUSTUDIO_LIVE=1`, so CI never holds a key and never touches the real API.
- **A `PreToolUse` hook refuses mutating HTTP requests to the Domustudio host.**
  See [`docs/read-only-guard.md`](docs/read-only-guard.md). It is a guardrail
  against accident, not a security boundary.

## If a key leaks

Rotate it in Domustudio first, then update every `.env` that carried it. A key
in git history is compromised even after the commit is removed.
