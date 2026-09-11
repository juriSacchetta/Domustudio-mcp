# Read-only guard

`.claude/hooks/block-domustudio-writes.sh` is a `PreToolUse` hook, registered in`.claude/settings.json` for `Bash|Write|Edit|MultiEdit`. It exits `2` to deny and `0` to allow; any internal failure allows.

This is **defence in depth, not a present danger**. The Domustudio public API has no write endpoints at all — the entire surface is three GETs. The guard exists so an agent does not burn a turn constructing a request that cannot succeed, and so the repo keeps its read-only posture if the API ever grows write endpoints.

Domustudio is the system of record. Anything that must change, changes there, by a human, in the product.

## What it blocks

Targets are recognised by the literal host `domustudioapi.danea.it` or the literal path `/api/external`.

**Bash** — within a single command segment (split on `;`, `&&`, `||`, `|`, newline), a target plus an HTTP CLI (`curl`, `wget`, `http`, `https`, `xh`, `xhs`, `httpie`) plus either:

- an explicit method outside `GET`/`HEAD`/`OPTIONS` — `curl -X POST`, `-XPOST`, `--request=DELETE`, `wget --method=PUT`, `http POST …`, `xh PATCH …`; or
- a request-body flag — curl `-d`/`--data*`/`-F`/`--form*`/`-T`/`--upload-file`/`--json`, wget `--post-data`/`--post-file`/`--body-data`/`--body-file`, an httpie/xh body item (`nome=Rossi`, `x:=1`, `file@path`) or `--json`/`--form`/`--raw`.

**Write/Edit/MultiEdit** — the content (or `new_string`) contains a code construct aimed at a mutating verb: `method: "POST"` / `method = "PUT"` in a string literal, an `axios`/`got`/`ky`/`superagent`/`requests`/`needle`/`undici` `.post`/`.put`/`.patch`/`.delete` call, or any `.post(`-style call whose first string argument names the target.
The target must appear either in the same content or in the file being edited.

## What it deliberately does not block

- **Prose.** Markdown, `.txt`, and plain comments. "The API exposes no POST endpoints." is allowed; only code constructs match.
- **Files under `.claude/hooks/`.** The guard's own script and test fixtures must be able to spell out the patterns they block.
- **`curl -G -d`** (a body flag that curl turns into query parameters) — treated as a GET.
- **Indirection.** `curl -X POST "$BASE_URL/persona"`, or a mutating request issued from inside an inline `python -c`/`node -e`. The guard matches text, not resolved values.
- Reads of every shape, including `-X GET` and `-I`.

Known false positives, accepted: a single segment that mixes a mutating flag for one host with a bare mention of the Domustudio host is denied; a source file that mentions the target anywhere is denied a mutating-verb construct anywhere in it, not just nearby; and an attached curl short-option *value* containing `d`, `F` or `T` reads as a body flag, so `curl -odata.json <target>` is denied where `curl -o data.json <target>` is not.
Telling those apart means modelling which curl options take arguments, which is more surface than this guard is worth. All three are cheap to work around and the guard is not meant to be subtle.

One rough edge: writing a file *through Bash* (a `cat <<EOF` heredoc) whose body contains a blocked pattern is judged by the Bash rules, which have no path exemption. Use the Write/Edit tools for files under `.claude/hooks/`.

## Running the tests

```
bash .claude/hooks/test-block-domustudio-writes.sh
```

Prints `PASS`/`FAIL` per case and exits non-zero if any case fails.

## Bypassing it

Edit or delete the hook, or remove its entry from `.claude/settings.json`. That is the
honest answer: this is a guardrail against accident, not a security boundary. Anyone
determined — or anyone running outside this repo — is unaffected. If you find yourself
wanting to bypass it, the question to answer first is why a write against a read-only API
is expected to work.
