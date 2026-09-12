# 0006 — MIT, and a public repository

Date: 2026-09-12
Status: **Proposed.** Accepted only once the copyright holder signs off; record
the sign-off by editing this line.

## Context

The repository carried proprietary "all rights reserved" terms. That was the
default for an internal tool rather than a decision: nothing here depends on
staying closed. The server is a thin client over a public, read-only API — three
GET endpoints — and holds no business logic the firm competes on.

Two facts constrain the choice.

The copyright is held by **Amministrazioni DeSa**, not by the committer. A
licence grant is made by the holder, so this ADR cannot be accepted on an
author's initiative alone.

The repository is named after, and documents the runtime behaviour of, a third
party's product. Danea's API agreement governs what may be disclosed about it,
and the product name is used nominatively throughout.

## Decision

MIT, copyright retained by Amministrazioni DeSa.

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
goes private does not un-licence what was already fetched. This is the reason
the status line above exists.

Anything the repository documents about the Domustudio API becomes public
alongside the code — the undocumented runtime behaviour most of all, since that
is the part a reader cannot obtain from the vendor's own spec.

A public repository accepts inbound contributions. `CONTRIBUTING.md` states that
they arrive under MIT, so a drive-by pull request needs no separate agreement.
