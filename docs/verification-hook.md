# Verification hook

`.claude/hooks/verify.sh` is a `Stop` hook, registered in `.claude/settings.json` with a
180-second timeout. It runs the repo's own checks when a session tries to finish, so a
session cannot end with the tree broken.

It exits `0` to let the session stop and `2` to block it. `2` is the exit code Claude Code
treats as "block and feed stderr back to the model" — so on failure the agent is handed the
error and gets a chance to fix it instead of walking away.

## What runs

In order, stopping at the first failure:

1. `npm run lint` — `eslint src test`
2. `npm test` — `tsc && vitest run` (typecheck, then the full suite)

Both are the package scripts verbatim; the hook does not reimplement them. Together they
take a couple of seconds and need no credentials.

The hook `cd`s to the repo root derived from its own location, not from `$PWD`, so it
behaves the same wherever Claude Code invokes it from.

## The live-API tests are never run

`test/live.test.ts` self-skips unless `DOMUSTUDIO_LIVE=1`. The hook `unset`s
`DOMUSTUDIO_LIVE` before running anything, so an operator who exports it in their shell
does not silently turn every session-stop into a run against the live Domustudio archive.
Run those deliberately with `npm run test:live`.

`NO_COLOR=1`, `FORCE_COLOR=0` and `CI=1` are exported so the output fed back to the model
is plain text rather than ANSI escapes.

## What blocking looks like

On success: one line on stdout, exit `0`.

```
verify.sh: lint and tests OK
```

On failure: the failing command, its exit code, and the **last 100 lines** of its combined
output, on stderr, exit `2`.

```
npm test failed (exit 2). Last 100 lines of output:

src/__scratch_break.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.
```

The tail is bounded on purpose: the whole log of a broken suite is mostly noise, and it is
being pasted into the model's context.

## The loop guard

A `Stop` hook fires again on the turn it triggers. Without a guard, a failure the agent
cannot fix blocks the session forever.

Claude Code passes `stop_hook_active: true` in the JSON payload on stdin when the stop is
already the result of a blocked stop. The hook reads stdin, matches that flag, and exits `0`
immediately — running nothing. So a failing suite blocks **once**, then the session is free
to end.

Verify it with:

```
time (echo '{"stop_hook_active":true}' | .claude/hooks/verify.sh)   # exits 0 in ~0.00s
echo '{"stop_hook_active":false}' | .claude/hooks/verify.sh         # actually runs
```

The near-zero elapsed time, not the exit code, is the proof it short-circuited.

## Skipping it deliberately

Three ways, loosest first:

- **One session** — export `DOMUSTUDIO_SKIP_VERIFY=1` before launching `claude`. The hook
  exits `0` without running anything. It must be exported in the environment Claude Code
  inherits; setting it inside a session does not reach the hook.
- **Permanently** — remove the `Stop` entry from `.claude/settings.json`.
- **Ad hoc** — the checks are just `npm run lint` and `npm test`. Run them yourself.

As with the read-only guard, this is a guardrail against finishing on a broken tree, not a
security boundary. Anyone who wants past it is past it.
