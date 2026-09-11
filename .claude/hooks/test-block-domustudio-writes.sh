#!/usr/bin/env bash
# Cases for block-domustudio-writes.sh. Run: bash .claude/hooks/test-block-domustudio-writes.sh
set -u

HOOK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/block-domustudio-writes.sh"
HOST='domustudioapi.danea.it'
PASS=0
FAIL=0

# expect: 0 allow, 2 deny
check() {
  local expect="$1" name="$2" payload="$3" actual
  printf '%s' "$payload" | "$HOOK" >/dev/null 2>&1
  actual=$?
  if [ "$actual" = "$expect" ]; then
    PASS=$((PASS + 1)); printf 'PASS  %s\n' "$name"
  else
    FAIL=$((FAIL + 1)); printf 'FAIL  %s (expected %s, got %s)\n' "$name" "$expect" "$actual"
  fi
}

bash_case() {
  local expect="$1" name="$2" cmd="$3"
  check "$expect" "$name" "$(python3 -c 'import json,sys; print(json.dumps({"tool_name":"Bash","tool_input":{"command":sys.argv[1]}}))' "$cmd")"
}

write_case() {
  local expect="$1" name="$2" path="$3" content="$4"
  check "$expect" "$name" "$(python3 -c 'import json,sys; print(json.dumps({"tool_name":"Write","tool_input":{"file_path":sys.argv[1],"content":sys.argv[2]}}))' "$path" "$content")"
}

# --- Bash: mutating requests at the Domustudio host ---
bash_case 2 'curl -X POST at host'          "curl -X POST https://$HOST/api/external/persona"
bash_case 2 'curl -XPOST attached'          "curl -XPOST https://$HOST/api/external/persona"
bash_case 2 'curl --request=DELETE'         "curl --request=DELETE https://$HOST/api/external/persona/1"
bash_case 2 'curl -d payload'               "curl -d '{\"a\":1}' https://$HOST/api/external/persona"
bash_case 2 'curl --data-binary'            "curl --data-binary @body.json https://$HOST/api/external/fornitore"
bash_case 2 'curl -F form upload'           "curl -F file=@x.csv https://$HOST/api/external/persona"
bash_case 2 'curl -T upload-file'           "curl -T x.csv https://$HOST/api/external/persona"
bash_case 2 'curl --json'                   "curl --json '{}' https://$HOST/api/external/persona"
bash_case 2 'wget --post-data'              "wget --post-data='x=1' https://$HOST/api/external/persona"
bash_case 2 'wget --method=PUT'             "wget --method=PUT --body-data='x' https://$HOST/api/external/persona"
bash_case 2 'httpie POST positional'        "http POST $HOST/api/external/persona"
bash_case 2 'xh PATCH positional'           "xh PATCH https://$HOST/api/external/fornitore"
bash_case 2 'httpie implicit POST body'     "http $HOST/api/external/persona nome=Rossi"
bash_case 2 'path-only reference'           "curl -X POST http://localhost:8080/api/external/persona"
bash_case 2 'mutating in second segment'    "echo hi && curl -X PUT https://$HOST/api/external/persona"

# --- Bash: reads and unrelated hosts stay allowed ---
bash_case 0 'plain GET at host'             "curl https://$HOST/api/external/condominio -H 'X-DANEA-API-KEY: k'"
bash_case 0 'explicit -X GET at host'       "curl -X GET https://$HOST/api/external/persona"
bash_case 0 'curl -I head request'          "curl -I https://$HOST/api/external/condominio"
bash_case 0 'POST at unrelated host'        'curl -X POST https://example.com/api/things -d x=1'
bash_case 0 'httpie GET with query param'   "http $HOST/api/external/persona SearchQuery==rossi"
bash_case 0 'httpie plain GET'              "http $HOST/api/external/persona"
bash_case 0 'grep mentioning host'          "grep -d skip $HOST notes.txt"
bash_case 0 'other-host POST, host named'   'echo "see example.com" | curl -X POST https://example.com/x -d y=1'

# --- Bash: malformed payloads must not crash ---
check 0 'missing tool_input'                '{"tool_name":"Bash"}'
check 0 'command is not a string'           '{"tool_name":"Bash","tool_input":{"command":{"oops":true}}}'
check 0 'empty object'                      '{}'
check 0 'garbled json'                      '{"tool_name":"Bash","tool_input":{"command":'
check 0 'empty stdin'                       ''
check 2 'unbalanced quotes still denied'    "{\"tool_name\":\"Bash\",\"tool_input\":{\"command\":\"curl -X POST 'https://$HOST/api/external\"}}"

# --- Write/Edit ---
write_case 2 'TS fetch method POST' 'src/client.ts' \
  "const BASE = 'https://$HOST/api/external';
await fetch(\`\${BASE}/persona\`, { method: \"POST\", body });"
write_case 2 'TS axios.post at host' 'src/client.ts' \
  "import axios from 'axios';
axios.post('https://$HOST/api/external/persona', body);"
write_case 0 'markdown prose about POST' 'docs/api.md' \
  "The API exposes no POST endpoints. Base URL: https://$HOST/api/external"
write_case 0 'TS comment prose only' 'src/client.ts' \
  "// The Domustudio API at https://$HOST/api/external has no POST or PUT endpoints.
const BASE_URL = 'https://$HOST/api/external';"
write_case 0 'GET fetch at host' 'src/client.ts' \
  "await fetch('https://$HOST/api/external/condominio', { method: 'GET', headers });"
write_case 0 'POST at unrelated host' 'src/other.ts' \
  "await fetch('https://example.com/v1/items', { method: 'POST', body });"
write_case 0 'hook test fixtures exempt' '.claude/hooks/test-block-domustudio-writes.sh' \
  "axios.post('https://$HOST/api/external/persona')"
check 2 'Edit new_string axios.delete' \
  "$(python3 -c 'import json,sys; print(json.dumps({"tool_name":"Edit","tool_input":{"file_path":"src/client.ts","new_string":sys.argv[1]}}))' \
     "axios.delete('https://$HOST/api/external/persona/1')")"
check 0 'Write without file_path'           '{"tool_name":"Write","tool_input":{"content":"hello"}}'
check 0 'unmatched tool name'               '{"tool_name":"Read","tool_input":{"file_path":"x.ts"}}'

printf '\n%s passed, %s failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
