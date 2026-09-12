# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **The licence is now MIT**, replacing the proprietary "all rights reserved"
  terms. Copyright stays with Amministrazioni DeSa.

### Removed

- The vendored `.claude/skills/mcp-builder/` copy, which carried its own
  Apache-2.0 terms. `.claude/skills/` is now gitignored; install the skill
  per-user instead.

## [0.2.0] — 2026-09-12

### Added

- The server reads `DOMUSTUDIO_ARCHIVES` and `DOMUSTUDIO_BASE_URL` from a `.env`
  in its working directory when the environment does not carry them, so a
  committed `.mcp.json` needs no `env` block and no credentials.
  `DOMUSTUDIO_ENV_FILE` names the file explicitly; set it empty to skip the
  lookup. Real environment variables win over the file.

### Changed

- A `DOMUSTUDIO_ARCHIVES` still holding a literal `${VAR}` is reported as an
  unexpanded client variable rather than as invalid JSON.
- A quoted `.env` value is refused, naming the file and the key, when anything
  but whitespace follows its closing quote or the opening quote is never closed.
  Either case previously swallowed content in silence.
- A malformed `DOMUSTUDIO_ARCHIVES` no longer carries the quoted fragment
  `JSON.parse` puts in its message, which repeated part of the credential.
- A `.env` that exists but cannot be read is reported instead of being treated as
  absent, which had let a permissions mistake fall back to a different archive.
- **The minimum Node version is now 22.12**, up from 20. Node 20 reached end of
  life and the test runner no longer supports it; CI runs 22 and 24.
- **Configure** in the README is split per client — Claude Code local scope, a
  committed `.mcp.json`, and GUI clients — because the previous single snippet,
  copied into `.mcp.json`, committed the API key ([#4]).

[#4]: https://github.com/Amministrazioni-DeSa/Domustudio-mcp/issues/4

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

[0.2.0]: https://github.com/Amministrazioni-DeSa/Domustudio-mcp/releases/tag/v0.2.0
[0.1.0]: https://github.com/Amministrazioni-DeSa/Domustudio-mcp/releases/tag/v0.1.0
