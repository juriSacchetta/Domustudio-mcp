# 0005 — Credentials come from a `.env`, not from the client config

Date: 2026-09-11
Status: **Accepted.**

## Context

Until 0.1.0 the only way to give the server its API key was an `env` block in the
MCP client's configuration. That is fine for `claude_desktop_config.json`, which
lives in a user profile, and wrong for `.mcp.json`, which lives at a project root
and is normally committed: the README offered the same snippet for both, so
following it put `X-DANEA-API-KEY` values into version control.

The obvious repair does not work. `.mcp.json` expands `${VAR}`, but supplying the
value through `.claude/settings.local.json` `env` left the server unable to
start: the unexpanded literal reached it and failed to parse, and the only
symptom the operator saw was `CONNECTION_CLOSED`. Issue #4 reproduced that twice,
with a control confirming the variable was present in the session.

**The mechanism is not established.** #4 inferred that expansion resolves against
the parent process environment before settings `env` is injected, and that
ordering is plausible, but it was never observed directly — and the published
documentation says Claude Code writes each `env` entry into its own process
environment, which cuts the other way. This ADR rests on the reproduced symptom,
not on the inference; if the ordering is ever pinned down, nothing here changes.

Exporting the variable from a shell rc file does make the expansion work, and
moves the key from one committed file to one dotfile.

The reporter's workaround — a committed launcher script that reads the project's
`.env` and execs the server — proves the shape of the answer, and also supplies
the fact the answer depends on: their `.mcp.json` referenced that launcher by the
**relative** path `.claude/mcp/domustudio.mjs` and it ran, so Claude Code
launches a stdio server with the project root as its working directory.

## Decision

The server reads a `KEY=value` file itself. `DOMUSTUDIO_ENV_FILE` names it;
otherwise it is `.env` in the working directory. Setting `DOMUSTUDIO_ENV_FILE`
to the empty string skips the lookup. A missing `.env` is silent; a
`DOMUSTUDIO_ENV_FILE` that cannot be read is a `ConfigError`.

Real environment variables win over the file, so an explicit `env` block or a
shell export still overrides it.

A `DOMUSTUDIO_ARCHIVES` whose whole value matches `${...}` is reported as an
unexpanded client variable rather than as invalid JSON.

The parser accepts single-line values and single- or double-quoted values that
may span lines — the only multi-line form `python-dotenv` accepts, so a `.env`
shared with a consuming Python project parses the same way here. Anything but
whitespace after the closing quote, or an opening quote that is never closed at
all, is a `ConfigError` naming the file and the key, never the value. Both cases
would otherwise swallow content in silence — the second one the entire remainder
of the file.

**Rejected: a bracket-balanced multi-line form.** #4 asked for it alongside the
other two. A `.env` whose array spans lines *unquoted* is not readable by
`python-dotenv` either, so accepting it here would mean accepting a file the
consuming project's own tooling rejects — and bracket balancing is the part of a
dotenv parser that rots first.

## Consequences

A committed `.mcp.json` carries no credentials: the default entry is
`{"command": "domustudio-mcp"}` and nothing else, and a client that runs the
server outside the project root adds a path-only `DOMUSTUDIO_ENV_FILE`. The
launcher script is unnecessary. Adding an archive is a `.env` edit.

The server parses the whole file, which in a consuming project may hold unrelated
secrets. It takes only `DOMUSTUDIO_ARCHIVES` and `DOMUSTUDIO_BASE_URL` from it,
never logs a value, and never propagates the merged environment: the `loadConfig`
call in `src/index.ts` is its only consumer. Keeping that true costs one step —
`JSON.parse` quotes the offending input in its own message, so that fragment is
stripped before the parse failure is reported. The startup line names the file, not its
contents.

Reading secrets from the working directory is the cost. It is bounded by
`DOMUSTUDIO_ENV_FILE`, which is the escape hatch for any client that launches the
server somewhere other than the project root.
