# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-09-11

First release.

### Added

- Read-only MCP server over the Danea Domustudio public API, stdio transport,
  five tools: `domustudio_list_archivi`, `domustudio_list_condomini`,
  `domustudio_get_condominio`, `domustudio_list_persone`,
  `domustudio_list_fornitori`. All annotated `readOnlyHint: true`.
- Multi-archive configuration through `DOMUSTUDIO_ARCHIVES`; every tool takes an
  optional `archivio`, defaulted when only one is configured.
- `markdown` and `json` response formats; integer enums decoded to
  `{ codice, etichetta }`.
- Retry policy covering 5xx and transport failures only, never 4xx.
- 78 tests against a local HTTP mock, plus 5 live tests that skip unless
  `DOMUSTUDIO_LIVE=1`.
- Two Claude Code hooks: a `PreToolUse` guard refusing mutating HTTP requests to
  the Domustudio host, and a `Stop` hook running lint and tests.

### Notes for implementers

These are properties of the upstream API, verified against it, not choices made
here:

- **Persone and fornitori have no identifier.** Neither schema contains an `id`
  and no endpoint accepts one, so there is no `get_persona`/`get_fornitore`.
- **Omitting `PageSize` does not disable paging — it defaults to 20.**
- **Responses carry no total**, so `ha_altre_pagine` is a heuristic: true when
  the last page read was full.
- A 401 arrives with a truncated chunked body; the status is classified before
  the body is read.

[0.1.0]: https://github.com/Amministrazioni-DeSa/Domustudio-mcp/releases/tag/v0.1.0
