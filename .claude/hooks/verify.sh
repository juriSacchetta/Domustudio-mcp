#!/usr/bin/env bash
# Stop hook: run the repo's lint and test commands before a session may finish.
# See docs/verification-hook.md.
#
# Exit 0 = let the session stop, exit 2 = block it (reason on stderr).

# Stop hooks re-fire on the turn they trigger; see docs/verification-hook.md.
if [ ! -t 0 ] && grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true' <<<"$(cat)"; then
    exit 0
fi

if [ -n "${DOMUSTUDIO_SKIP_VERIFY:-}" ]; then
    exit 0
fi

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." || {
    echo "verify.sh: cannot locate repo root" >&2
    exit 2
}

# test/live.test.ts self-skips unless this is set; the hook must never opt in.
unset DOMUSTUDIO_LIVE
export NO_COLOR=1 FORCE_COLOR=0 CI=1

run() {
    local label="$1"
    shift
    local out rc
    out="$("$@" 2>&1)"
    rc=$?
    if [ "$rc" -ne 0 ]; then
        printf '%s failed (exit %d). Last 100 lines of output:\n\n' "$label" "$rc" >&2
        tail -n 100 <<<"$out" >&2
        exit 2
    fi
}

run 'npm run lint' npm run lint --silent
run 'npm test' npm test --silent

echo "verify.sh: lint and tests OK"
