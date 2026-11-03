# 0007 — Compact, locally paginated condominium lists

Date: 2026-11-03
Status: **Accepted.**

## Context

The condominium API returns an entire archive without pagination. Returning its
complete records in MCP list results can exhaust an assistant's context even
when a caller only needs a building ID. Issue #43 documents one such incident.

## Decision

Filter the complete upstream list using the existing case-insensitive search,
then select a local page: 25 records by default, at most 100. Keep `ricerca`
optional for inventories. Return only identifying fields in both list formats
and structured content: ID, heading, address, postcode, city, province and tax
code. Keep records permissive as in ADR 0003, but project the allowed fields.
The full record remains available through `domustudio_get_condominio`.

Report the exact match total, current page count, page number and size, and
whether another page exists; include the next page number only when it does.
Do not offer an all-pages mode for this list. Reuse the existing page parameter
names and validation limits, with descriptions identifying local pagination.

## Consequences

Version 0.5.0 changes the list contract: clients enumerating an archive must
follow pages and clients consuming detail fields must use the detail tool.
Network traffic to Danea remains unchanged. Pagination is not a snapshot;
upstream edits between calls can change ordering or membership. No claim of
total LLM cost savings follows merely from measuring response bytes.
