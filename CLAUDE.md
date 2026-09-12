# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What this is

An MCP server exposing the **Danea Domustudio** public API — the property-management software the firm runs on — as tools an agent can call.

The server is scaffolded and green: TypeScript on the official MCP SDK, stdio transport, five read-only tools over a local mock in the test suite. The API facts below are the ones an implementation has to get right; the decisions that shaped the tool surface are in `docs/adr/`.

## Decisions taken

- **The server reads the Domustudio REST API directly**
- **TypeScript**, official MCP SDK.
- **stdio transport**, launched locally by the client. No deploy, no shared instance; the API key lives in the operator's local environment.

## The Domustudio API

Spec: `https://domustudioapi.danea.it/swagger/ExtV1.0/swagger.json` (OpenAPI 3.0.1,
"Domustudio Web API Clienti" v1.0), browsable at `/swagger/index.html`.

Base URL `https://domustudioapi.danea.it/api/external`. The spec's `servers` entry says `http://`; use HTTPS regardless.

**The entire public surface is three GET endpoints.** There are no write operations and no `*Write`/`*Create` schemas — read-only is what the API offers, not a choice this repo made. Domustudio remains the system of record: anything that must change, changes there, by a human, in the product.

| Endpoint | Paginated | Notable parameters |
|---|---|---|
| `GET /condominio` | no — returns the full list | none |
| `GET /persona` | yes | `CondGendID` (scopes to one condominio), `FiltroSubentri`, `EsercizioID`, `TagsID`, `SearchQuery`, `OrderBy` |
| `GET /fornitore` | yes — global, not per-condominio | `Attivi`, `DatiIncompleti`, `Attivita`, `ImpiantoServizioID`, `EserciziID`, `SearchQuery`, `OrderBy` |

"The reference client" below is an existing internal Domustudio client the firm
already runs in production; its behaviour is cited as evidence, not as an API
guarantee.

Facts that will bite an independent reimplementation:

- **Auth is one header:** `X-DANEA-API-KEY`, on every endpoint. Send `x-api-version: 1.0` alongside it. The spec marks both `required: false` — they are not optional.
- **Responses are bare JSON arrays.** No envelope and no total count; no pagination headers are documented in the spec, though the runtime may send some. The reference client pages by incrementing `PageNumber` (1-based) and stopping on the first empty page.
- **A 401 arrives with a truncated chunked body** (Kestrel). Check the status on the response headers *before* reading the body, or the parse error masks the auth error.
- **The reference client retries 5xx and timeouts only, never 4xx** — a 401 or 404 will not become a 200. That is its policy, not an API guarantee, and it has held in production.
- `FiltroSubentri` takes `AnagraficaFiltroCondominiAttivi`: `1` tutti, `2` attivi, `3` ex, `4` contabilità, `5` destinatari comunicazioni. The reference client's sync passes `2`.
- **Omitting `PageSize` does not disable paging: it defaults to 20.** Verified against the live API — `/persona` with no `PageNumber`/`PageSize` returned 20 records for a condominio that has more. Always send both.
- Verified against the live API on 2026-09-11: the response field names match the spec exactly on all three endpoints, with no undocumented extras. Note the casing in `amministratore`: `codfisc` and `partiva`, not `codFisc`/`piva` as on the other schemas.
- One API key addresses one **archive**. The reference client models credentials as a list and takes coexisting archives as a requirement — configure for several from the start, not one.

## Conventions

- Issues on GitHub on this repository, via the `gh` CLI.
- Domain vocabulary is Italian and stays Italian in identifiers that name domain concepts — `condominio`, `persona`, `fornitore`, `esercizio`. Do not translate them.
- Decision records go in `docs/adr/`; a `CONTEXT.md` glossary once the vocabulary earns one. Both are patterns the sibling repos follow.
- Rationale lives in commit messages and `docs/adr/`, never in source comments.
- Identifiers and user-facing strings are Italian; ADRs and this file are English.
- Filenames under `src/` are one lowercase word: `config.ts`, `registry.ts`, `env.ts`.

## Layout

| Path | |
|---|---|
| `src/domustudio/client.ts` | HTTP client: auth headers, 1-based paging, retry policy |
| `src/domustudio/enums.ts` | Integer enums → `{ codice, etichetta }` |
| `src/config.ts`, `src/registry.ts` | `DOMUSTUDIO_ARCHIVES` parsing, one client per archive |
| `src/env.ts` | `.env` fallback for the environment, so a committed `.mcp.json` carries no key |
| `src/tools/` | One module per endpoint, plus `shared.ts` for the common zod fields and envelope |
| `src/format.ts` | Markdown rendering and output truncation |
| `test/helpers/mockApi.ts` | Local HTTP mock of the API, including the truncated 401 |

## Commands

| | |
|---|---|
| `npm run build` | compile to `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | eslint over `src` and `test` |
| `npm test` | typecheck + full suite |
| `npm run test:unit` | suite only, skipping the build |
| `npm run test:live` | suite against the real API; needs a `.env`, see `README.md` |
| `npm run inspector` | MCP Inspector against `dist/index.js` |

Single file: `npx vitest run test/client.test.ts`. Single case:
`npx vitest run -t "non tocca il corpo di un 401 troncato"`.

The suite needs no credentials — `test/live.test.ts` skips unless `DOMUSTUDIO_LIVE=1`.

## Guard rails

A `PreToolUse` hook (`.claude/hooks/`) refuses commands and edits that would send a
mutating HTTP request to the Domustudio host. The API has no write endpoints, so this
guards against wasted effort and against a future API gaining them. See
`docs/read-only-guard.md`.
