# domustudio-mcp-server

[![CI](https://github.com/Amministrazioni-DeSa/Domustudio-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Amministrazioni-DeSa/Domustudio-mcp/actions/workflows/ci.yml)

An MCP server that exposes the **Danea Domustudio** public API — condomini,
persone, fornitori — as tools an agent can call.

The API is read-only: its entire public surface is three GET endpoints. This
server adds no write path, because there is none to add. Domustudio remains the
system of record; anything that must change, changes there, by a human, in the
product.

## Requirements

- Node.js ≥ 20
- One Domustudio API key per archive (`X-DANEA-API-KEY`)

## Install it in another repository

The package is not on any registry — it installs straight from this private
repo, pinned to a release tag. One global install serves every repository on the
machine.

```sh
npm install -g --allow-git=all "github:Amministrazioni-DeSa/Domustudio-mcp#v0.1.0"
```

`--allow-git=all` is required on **npm 12 and later**, which ships
`allow-git = "none"` as a default and otherwise refuses the install with
`EALLOWGIT`. To stop passing it every time:

```sh
npm config set allow-git all
```

npm builds `dist/` during install, so the machine needs nothing beyond Node ≥ 20
and read access to this repo. npm 12 also prints
`install scripts blocked … (prepare: npm run build)` — that warning is benign
here: it refers to the consumer's tree, and the build has already run inside
npm's isolated step for the git dependency. Confirm the install with:

```sh
test -f "$(npm root -g)/domustudio-mcp-server/dist/index.js" && echo installed
```

Do not run the entry point to "check" it: it is a stdio MCP server with no CLI,
so it will start and wait for JSON-RPC on stdin rather than print anything.

Then print the absolute path to hand the MCP client:

```sh
echo "$(npm root -g)/domustudio-mcp-server/dist/index.js"
```

and point each repository's MCP config at it — see **Configure** below. To
upgrade, rerun the install command with a newer tag; every repository on the
machine picks it up at once, which is the trade-off of a single global install.

## Develop on it here

```sh
npm install
npm run build
```

## Configure

The server reads its credentials from the environment. `DOMUSTUDIO_ARCHIVES` is a
JSON array — one API key addresses exactly one archive, and several archives may
coexist:

```jsonc
// claude_desktop_config.json, .mcp.json, or your client's equivalent
{
  "mcpServers": {
    "domustudio": {
      "command": "node",
      // output of: echo "$(npm root -g)/domustudio-mcp-server/dist/index.js"
      "args": ["/absolute/path/to/domustudio-mcp-server/dist/index.js"],
      "env": {
        "DOMUSTUDIO_ARCHIVES": "[{\"name\":\"desa\",\"api_key\":\"...\"}]"
      }
    }
  }
}
```

| Variable | Required | Default |
|---|---|---|
| `DOMUSTUDIO_ARCHIVES` | yes | — |
| `DOMUSTUDIO_BASE_URL` | no | `https://domustudioapi.danea.it/api/external` |

`DOMUSTUDIO_BASE_URL` exists for tests and for pointing at a mock; production
should leave it unset. The default is HTTPS even though the OpenAPI `servers`
entry says `http://`.

The key is never echoed in a tool result: an authentication failure names the
archive and the header, not the value.

## Tools

| Tool | What it does |
|---|---|
| `domustudio_list_archivi` | Names of the configured archives |
| `domustudio_list_condomini` | All condomini; optional local `ricerca` filter |
| `domustudio_get_condominio` | One condominio by `id` |
| `domustudio_list_persone` | Persone, optionally scoped to a condominio; paginated |
| `domustudio_list_fornitori` | Fornitori of the whole archive; paginated |

All five are annotated `readOnlyHint: true`, `destructiveHint: false`.

Every tool takes an optional `archivio`. With a single archive configured it may
be omitted; with several, omitting it returns an error listing the names.

Every tool takes `response_format`: `markdown` (default) renders the main fields
for reading, `json` returns the full API record. Integer enums are decoded to
`{ codice, etichetta }`.

### What the API does not give you

**Persone and fornitori have no identifier.** Neither schema contains an `id`,
and no endpoint accepts one, so there is no `get_persona` and no
`get_fornitore` — a person or supplier is reached by filtering a list. The
condominio `id` is the only stable handle the API exposes, and it is what
`domustudio_list_persone` takes as `condominio_id`.

**There is no total count.** Responses are bare JSON arrays. `ha_altre_pagine`
is therefore a heuristic — true when the last page read was full — and is
documented as such in the tool descriptions. See
[docs/adr/0002](docs/adr/0002-pagination-without-a-total.md).

## Development

| Command | |
|---|---|
| `npm run build` | compile to `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | eslint over `src` and `test` |
| `npm test` | typecheck + full suite |
| `npm run test:unit` | suite only, no build |
| `npm run test:live` | suite against the real API (see below) |
| `npm run inspector` | MCP Inspector against `dist/index.js` |

The suite runs against a local HTTP mock of the Domustudio API and needs no
credentials. It covers the client (headers, 1-based paging, retry policy, the
truncated-401), configuration and archive resolution, enum decoding, markdown
rendering, every tool over an in-memory MCP transport, and the built binary over
real stdio.

### Running against the real API

Put real credentials in a `.env` at the repo root — it is gitignored:

```sh
printf 'DOMUSTUDIO_ARCHIVES=[{"name":"desa","api_key":"..."}]\n' > .env
chmod 600 .env
npm run test:live
```

Without `DOMUSTUDIO_LIVE=1` those tests skip, so `npm test` stays green on a
machine with no credentials. They only read, and assert on shapes and counts —
no record content is printed.

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — API facts an implementation has to know
- [`docs/adr/`](docs/adr/) — decisions and why they are hard to reverse
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — the loop, the conventions, how to add a tool
- [`SECURITY.md`](SECURITY.md) — credential handling and how to report a vulnerability
- [`docs/read-only-guard.md`](docs/read-only-guard.md) — the hook that refuses mutating requests
- [`docs/verification-hook.md`](docs/verification-hook.md) — the hook that runs lint and tests

## License

Proprietary — see [`LICENSE`](LICENSE). Copyright (c) 2026 Amministrazioni DeSa.
