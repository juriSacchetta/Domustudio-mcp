# 0003 — The envelope is typed; the records are not

Date: 2026-09-11
Status: **Accepted.**

## Context

The MCP SDK validates `structuredContent` against a declared `outputSchema` and
turns a mismatch into a protocol error — the agent gets a failed call, not a
degraded one.

The record schemas would be the natural thing to declare. They are also the part
that cannot be trusted: `AnagraficaFornitoreReadViewModel` alone has around 60
fields, the spec is already known to be inexact about its own headers (`required:
false` on two headers that are mandatory) and about its transport (`servers` says
`http://`), and this repo has never seen a live response. A strict record schema
turns any drift between spec and runtime — one extra field, one `string` that
arrives as a number — into a total failure of a read-only call.

## Decision

Declare the envelope strictly, since this server constructs it: `archivio`,
`conteggio`, the pagination fields, `elementi`. Declare `elementi` as
`z.record(z.string(), z.unknown())` — an object, nothing more.

The record fields are documented where an agent actually reads them: in the tool
description, which lists the notable ones and states that the JSON format
carries the full API record.

## Verified since

A live read on 2026-09-11 returned exactly the spec's field names on all three
endpoints — no undocumented extras. The drift this ADR guards against had not
happened yet at the time of writing; the decision stands on the cost asymmetry,
not on observed drift.

## Consequences

A field added by Danea flows through instead of breaking the call. The cost is
that an agent cannot rely on the output schema to know a record's shape, which
the descriptions cover.

Reversible in one direction: once a live response has been observed, record
schemas can be tightened field by field. Going the other way — discovering in
production that a declared schema was wrong — is the failure this avoids.
