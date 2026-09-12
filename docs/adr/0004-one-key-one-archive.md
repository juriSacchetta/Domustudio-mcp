# 0004 — Archives are plural from the start

Date: 2026-09-11
Status: **Accepted.**

## Context

One Domustudio API key addresses exactly one archive. The firm runs more than
one, and the reference client already models credentials as a list rather than a
single key — retrofitting that shape onto a server built for one archive would
mean changing every tool signature.

## Decision

`DOMUSTUDIO_ARCHIVES` is a JSON array of `{"name", "api_key"}`. One
`DomustudioClient` per entry, held in an `ArchiveRegistry`.

Every tool takes an optional `archivio`. Resolution:

- exactly one archive configured → the parameter may be omitted, that archive is used
- several configured, parameter omitted → an error naming all of them
- unknown name → an error naming all of them

`domustudio_list_archivi` exists so the agent can discover the names rather than
learning them from an error.

The key never appears in a tool result. `DomustudioAuthError` names the archive
and the header, not the value.

## Consequences

A second archive is a configuration change, never a code change. The cost is one
optional parameter on every tool, which is inert for a single-archive operator.
