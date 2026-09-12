# 0006 — MIT, and a public repository

Date: 2026-09-12
Status: **Accepted.**

## Context

The repository carried proprietary "all rights reserved" terms, intestate to
Amministrazioni DeSa. That was the default for something built alongside the
firm's operations rather than a decision anyone took: nothing here depends on
staying closed. The server is a thin client over a public, read-only API — three
GET endpoints — and holds no business logic the firm competes on.

Copyright is the author's. The repository lived under the firm's GitHub
organisation because that is where the work happened, not because the firm holds
rights in it; hosting and ownership are unrelated. The repository has been
transferred to the author's account and the attribution now matches.

One constraint is outside the author's gift. The repository is named after, and
documents the runtime behaviour of, a third party's product. Danea's API
agreement governs what may be disclosed about it, and the product name is used
nominatively throughout.

## Decision

MIT, copyright `Juri Sacchetta`.

MIT over Apache-2.0: the MCP SDK this server is built on is MIT, so the
ecosystem's default applies, and the patent grant Apache-2.0 adds guards against
a risk a REST client does not carry.

Two consequences follow from the grant rather than being separate choices:

- The vendored `.claude/skills/mcp-builder/` copy is removed from the tree. It
  is Anthropic's, under Apache-2.0, and keeping it would make the repository
  MIT-except-one-path. It is a dev-time tool, not part of the server, and
  installs per-user.
- The README carries a trademark disclaimer, because the repository's own name
  is someone else's mark.

`package.json` keeps `"private": true`. The licence and the registry are
separate decisions; the README's git-install flow is unaffected by either.

## Consequences

**An MIT grant on a published tag cannot be withdrawn.** A later repository that
goes private does not un-licence what was already fetched.

Amministrazioni DeSa runs this server as an operational tool and now depends on
a repository outside their organisation. MIT is what makes that safe: the grant
does not expire and does not need renegotiating, whatever happens to the working
relationship.

Anything the repository documents about the Domustudio API becomes public
alongside the code — the undocumented runtime behaviour most of all, since that
is the part a reader cannot obtain from the vendor's own spec.

A public repository accepts inbound contributions. `CONTRIBUTING.md` states that
they arrive under MIT, so a drive-by pull request needs no separate agreement.
