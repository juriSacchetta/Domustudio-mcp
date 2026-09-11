# Contributing

## Before you start

Read [`CLAUDE.md`](CLAUDE.md) — it holds the API facts that bite a
reimplementation, and the conventions this repo follows. Read
[`docs/adr/`](docs/adr/) for decisions that are expensive to reverse.

## The loop

```sh
npm install
npm test          # typecheck + full suite, no credentials needed
npm run lint
```

A change is ready when `npm run lint` and `npm test` are both clean. A `Stop`
hook runs both at the end of an agent session; see
[`docs/verification-hook.md`](docs/verification-hook.md).

Single file: `npx vitest run test/client.test.ts`.
Single case: `npx vitest run -t "<part of the test name>"`.

## Conventions

- **Domain vocabulary is Italian and stays Italian** in identifiers that name
  domain concepts — `condominio`, `persona`, `fornitore`, `esercizio`. Do not
  translate them. User-facing strings are Italian; ADRs, this file and
  `CLAUDE.md` are English.
- **Rationale goes in the commit message or an ADR, never in a source comment.**
  Comments carry contracts and external constraints only.
- **No AI attribution in commit messages.**
- Issues live on GitHub under the `Amministrazioni-DeSa` org.

## Adding a tool

The API is read-only — three GET endpoints, no write path. A new tool is a new
view over those, not a new capability. Match the existing shape:

- name it `domustudio_<verb>_<noun>`, annotate it `readOnlyHint: true`
- take the optional `archivio` parameter and resolve it through `ArchiveRegistry`
- declare the envelope in `outputSchema`, leave records as opaque objects
  (see [ADR 0003](docs/adr/0003-permissive-output-schemas.md))
- document the record fields in the tool description, where an agent reads them
- cover it in `test/tools.test.ts` against the local mock

## Changing what the API does

You cannot. Domustudio is the system of record: a wrong datum is corrected by a
human inside the product. If you find yourself wanting a write path, the answer
is upstream, not here.

## Touching credentials

Never commit a real key. See [`SECURITY.md`](SECURITY.md).
