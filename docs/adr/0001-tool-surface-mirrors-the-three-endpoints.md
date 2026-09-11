# 0001 — The tool surface mirrors the three endpoints, and adds no identity the API does not have

Date: 2026-09-11
Status: **Accepted.**

## Context

The Domustudio public API is three GET endpoints: `/condominio`, `/persona`,
`/fornitore`. A tempting MCP design is the CRUD-shaped one an agent expects from
most servers — `get_persona(id)`, `get_fornitore(id)`, `search_*` — and it cannot
be built honestly here. Reading the OpenAPI schemas:

| schema | has an `id` |
|---|---|
| `CondominioExtReadViewModel` | yes, `id: int32` |
| `AnagraficaPersonaReadViewModel` | **no** |
| `AnagraficaFornitoreReadViewModel` | **no** |

A persona record carries `descr`, `codFisc`, addresses and contacts, and nothing
that identifies it to the API. Neither does a fornitore. There is no endpoint
that accepts one, either. The only stable handle the API exposes is the
condominio `id`, and its only use is as `CondGendID` when listing persone.

An agent that is handed `get_persona` will assume such an identifier exists,
will look for it in the returned records, and will not find it.

## Decision

Five tools, named for what the API actually does:

- `domustudio_list_archivi`
- `domustudio_list_condomini`
- `domustudio_get_condominio`
- `domustudio_list_persone`
- `domustudio_list_fornitori`

`domustudio_get_condominio` is a client-side selection over the full condominio
list, not an API read — the endpoint is not paginated and returns everything, so
the round trip is the same one `list_condomini` makes.

No `get_persona` and no `get_fornitore`. Each list tool's description states, in
its first lines, that the record has no identifier and that a person or supplier
is reached by filtering the list.

`domustudio_list_condomini` filters on `ricerca` locally, because `/condominio`
takes no query parameters at all. The persone and fornitori tools pass
`SearchQuery` and `OrderBy` straight through and describe them as such: the
OpenAPI spec documents neither's semantics, and guessing them in a tool
description would be inventing a contract.

## Consequences

An agent looking for one person pages or searches a list, which is what the API
supports. The absence is documented where the agent reads, not only here.

If Domustudio ever exposes an identifier, `get_persona` becomes addable without
reshaping anything: the list tools keep their meaning.
