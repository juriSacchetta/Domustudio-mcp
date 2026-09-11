#!/usr/bin/env bash
# PreToolUse guard: refuse operations that would write through the Domustudio API.
# See docs/read-only-guard.md.
#
# Exit 0 = allow, exit 2 = deny (reason on stderr). Any internal failure allows.
exec python3 -c "$(cat <<'PY'
import json
import os
import re
import shlex
import sys

HOST = "domustudioapi.danea.it"
API_PATH = "/api/external"

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

HTTP_CLIS = {"curl", "wget", "http", "https", "xh", "xhs", "httpie"}
HTTPIE_CLIS = {"http", "https", "xh", "xhs", "httpie"}

SEGMENT_SEP = re.compile(r"&&|\|\||[;|\n]")

CURL_BODY_LONG = (
    "--data", "--data-raw", "--data-binary", "--data-urlencode", "--data-ascii",
    "--form", "--form-string", "--upload-file", "--json",
)
WGET_BODY_LONG = ("--post-data", "--post-file", "--body-data", "--body-file")
HTTPIE_BODY_FLAGS = {"--json", "-j", "--form", "-f", "--raw", "--multipart"}

# JS/TS/Python request construction aimed at a mutating verb.
CONSTRUCT_PATTERNS = (
    re.compile(r"""\bmethod\s*[:=]\s*['"`]\s*(POST|PUT|PATCH|DELETE)\b""", re.I),
    re.compile(r"\b(axios|got|ky|superagent|requests|needle|undici|wreck)\s*\.\s*(post|put|patch|delete)\s*\(", re.I),
    re.compile(
        r"""\.\s*(post|put|patch|delete)\s*\(\s*(?:`|'|")[^`'"]*(?:"""
        + re.escape(HOST) + r"|" + re.escape(API_PATH) + r")",
        re.I,
    ),
)

DENY_MESSAGE = """BLOCKED: this operation would write through the Danea Domustudio API.

Domustudio is the system of record and its public API is read-only: the whole
surface is three GET endpoints (/condominio, /persona, /fornitore). There is no
write endpoint to call, so a mutating request cannot succeed -- it can only waste
time or corrupt a local assumption.

Any change to condomini, persone or fornitori must be made by a human, inside the
Domustudio product. Read the data here; change it there.

If you were only trying to READ, drop the mutating flag (-X/--request, -d/--data,
-F/--form, -T/--upload-file, --json, wget --post-data/--method) and issue a plain
GET. If you believe this guard is wrong, see docs/read-only-guard.md."""


def targets_domustudio(text):
    return HOST in text or API_PATH in text


def tokenize(segment):
    try:
        return shlex.split(segment, comments=False, posix=True)
    except ValueError:
        return segment.split()


def is_short_cluster(token):
    return bool(re.match(r"^-[A-Za-z]+$", token))


def curl_method(tokens):
    """Method named by -X / --request, including -XPOST and -sX POST forms."""
    for i, tok in enumerate(tokens):
        if tok.startswith("--request"):
            if "=" in tok:
                return tok.split("=", 1)[1]
            return tokens[i + 1] if i + 1 < len(tokens) else None
        m = re.match(r"^-[A-Za-z]*X([A-Za-z]*)$", tok)
        if m:
            if m.group(1):
                return m.group(1)
            return tokens[i + 1] if i + 1 < len(tokens) else None
    return None


def wget_method(tokens):
    for i, tok in enumerate(tokens):
        if tok.startswith("--method"):
            if "=" in tok:
                return tok.split("=", 1)[1]
            return tokens[i + 1] if i + 1 < len(tokens) else None
    return None


def httpie_method(tokens, cli_index):
    for tok in tokens[cli_index + 1:]:
        if tok.startswith("-"):
            continue
        if re.match(r"^[A-Za-z]+$", tok) and tok.upper() in (SAFE_METHODS | MUTATING_METHODS):
            return tok
        return None
    return None


def curl_has_body_flag(tokens):
    if any(t == "--get" or re.match(r"^-[A-Za-z]*G[A-Za-z]*$", t) for t in tokens):
        return False
    for tok in tokens:
        if tok.startswith("--"):
            name = tok.split("=", 1)[0]
            if name in CURL_BODY_LONG:
                return True
        elif is_short_cluster(tok) and any(c in tok[1:] for c in ("d", "F", "T")):
            return True
        elif re.match(r"^-[A-Za-z]*[dFT].+$", tok):
            return True
    return False


def wget_has_body_flag(tokens):
    return any(tok.split("=", 1)[0] in WGET_BODY_LONG for tok in tokens)


def httpie_has_body_item(tokens, cli_index):
    for tok in tokens[cli_index + 1:]:
        if tok in HTTPIE_BODY_FLAGS:
            return True
        if tok.startswith("-"):
            continue
        if ":=" in tok:
            name = tok.split(":=", 1)[0]
            if re.match(r"^[A-Za-z_][A-Za-z0-9_.\-]*$", name):
                return True
        if "==" in tok:
            continue
        if "=" in tok:
            name = tok.split("=", 1)[0]
            if re.match(r"^[A-Za-z_][A-Za-z0-9_.\-]*$", name):
                return True
        if "@" in tok and not tok.startswith("@"):
            name = tok.split("@", 1)[0]
            if re.match(r"^[A-Za-z_][A-Za-z0-9_.\-]*$", name):
                return True
    return False


def segment_denies(segment):
    if not targets_domustudio(segment):
        return False
    tokens = tokenize(segment)
    clis = [(i, os.path.basename(t)) for i, t in enumerate(tokens)
            if os.path.basename(t) in HTTP_CLIS]
    if not clis:
        return False
    for index, name in clis:
        if name == "curl":
            method = curl_method(tokens)
            if method and method.upper() not in SAFE_METHODS:
                return True
            if curl_has_body_flag(tokens):
                return True
        elif name == "wget":
            method = wget_method(tokens)
            if method and method.upper() not in SAFE_METHODS:
                return True
            if wget_has_body_flag(tokens):
                return True
        else:
            method = httpie_method(tokens, index)
            if method and method.upper() not in SAFE_METHODS:
                return True
            if httpie_has_body_item(tokens, index):
                return True
    return False


def check_bash(command):
    if not isinstance(command, str):
        return False
    return any(segment_denies(seg) for seg in SEGMENT_SEP.split(command))


def is_exempt_path(path):
    """The guard's own script, its tests, and prose are not blocked."""
    if not isinstance(path, str):
        return False
    normalized = path.replace(os.sep, "/")
    if "/.claude/hooks/" in normalized or normalized.startswith(".claude/hooks/"):
        return True
    return os.path.splitext(normalized)[1].lower() in (".md", ".markdown", ".txt")


def file_mentions_host(path):
    if not isinstance(path, str):
        return False
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as handle:
            return targets_domustudio(handle.read(1_000_000))
    except OSError:
        return False


def check_content(content, file_path):
    if not isinstance(content, str) or not content.strip():
        return False
    if not any(pattern.search(content) for pattern in CONSTRUCT_PATTERNS):
        return False
    return targets_domustudio(content) or file_mentions_host(file_path)


def check_edit(tool_input):
    path = tool_input.get("file_path")
    if is_exempt_path(path):
        return False
    candidates = [tool_input.get("content"), tool_input.get("new_string")]
    edits = tool_input.get("edits")
    if isinstance(edits, list):
        candidates.extend(e.get("new_string") for e in edits if isinstance(e, dict))
    return any(check_content(c, path) for c in candidates)


def decide(payload):
    if not isinstance(payload, dict):
        return False
    tool_input = payload.get("tool_input")
    if not isinstance(tool_input, dict):
        return False
    tool = payload.get("tool_name")
    if tool == "Bash":
        return check_bash(tool_input.get("command"))
    if tool in ("Write", "Edit", "MultiEdit"):
        return check_edit(tool_input)
    return False


try:
    if decide(json.loads(sys.stdin.read() or "{}")):
        sys.stderr.write(DENY_MESSAGE + "\n")
        sys.exit(2)
except Exception:
    pass
sys.exit(0)
PY
)"
