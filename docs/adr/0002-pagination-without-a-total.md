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
`PageSize` does not return everything — the API defaults it to 20.

`tutte_le_pagine` walks pages up to `MAX_PAGES_PER_CALL`, so one call can return
a whole condominio's roster without the agent driving the loop, and an archive
larger than the cap fails loudly in a field rather than silently truncating.

## Consequences

An agent that trusts `ha_altre_pagine` makes at most one wasted request per
listing, and never misses data. Should the runtime turn out to send pagination
headers the spec omits, this is the one place that changes.
