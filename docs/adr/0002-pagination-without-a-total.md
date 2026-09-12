# 0002 — `ha_altre_pagine` is a heuristic, and says so

Date: 2026-09-11
Status: **Accepted.**

## Context

`/persona` and `/fornitore` are paginated by `PageNumber` (1-based) and
`PageSize`. The response is a bare JSON array: no envelope, no total count, no
documented pagination headers. The reference client — an internal Domustudio
client the firm already runs in production — pages by incrementing `PageNumber`
until a page comes back empty.

MCP guidance asks list tools to return `total_count`, `has_more` and a next
offset. Two of the three cannot be computed here, and the third only by
inference. Reporting a `totale` the API never sent would be a fabricated number
an agent would then reason from.

## Decision

The envelope reports what is known and labels what is inferred:

- `conteggio` — items in this response. There is no `totale`.
- `pagina`, `dimensione_pagina`, `pagine_lette` — what was requested and read.
- `ha_altre_pagine` — **true when the last page read was full.** A total of
  exactly `n × PageSize` therefore reports one page too many; the extra request
  returns empty and settles it. The tool descriptions state this.
- `prossima_pagina` — present only when `ha_altre_pagine`.
- `troncato_al_limite_pagine` — the `tutte_le_pagine` run hit its cap.

Both `PageNumber` and `PageSize` are sent on every request, always. Omitting
`PageSize` does not return everything — the API defaults it to 20 — and asking
for more than it serves is refused: `MAX_PAGE_SIZE` is the page cap the API is
reported to enforce, so a larger `dimensione_pagina` fails validation before a
request goes out.

`tutte_le_pagine` walks pages up to `MAX_PAGES_PER_CALL`, so one call can return
a whole condominio's roster without the agent driving the loop, and an archive
larger than the cap fails loudly in a field rather than silently truncating.

## Consequences

An agent that trusts `ha_altre_pagine` makes at most one wasted request per
listing, and misses no data — which holds only while no page can come back
capped, as the amendment below records. Should the runtime turn out to send
pagination headers the spec omits, this is the one place that changes.

## Amended 2026-09-12

A short page was read as the end of the data, by `ha_altre_pagine` and by the
`getPages` walk alike. Both are wrong when the API serves fewer rows than were
asked for: `dimensione_pagina: 200` came back as 100 rows and
`ha_altre_pagine: false`, and everything past the first hundred was lost
without a signal ([#25](https://github.com/juriSacchetta/Domustudio-mcp/issues/25)).

Reported, from one live call: the API caps a page at 100. Verified here: the
OpenAPI spec declares no `maximum` on `PageSize`, so the old ceiling of 500 was
a guess with nothing behind it. `npm run test:live` now measures the cap
against a real archive, which is what would catch Danea moving it.

With the ceiling set to the cap, stop-on-short-page is sound again: nothing the
schema admits can come back capped. Clamping 200 to 100 internally was refused
— the envelope would have reported `dimensione_pagina: 200` over 100-row pages,
the invented number this ADR exists to avoid.

Still open, and no longer load-bearing: whether an over-cap `PageSize` offsets
`PageNumber=2` by the size requested or the size served.
