#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://tothread-webapp.zhian-job.workers.dev}"
TOKEN="${GOOGLE_TOKEN:-}"

if [[ -z "$TOKEN" ]]; then
  cat <<'MSG'
GOOGLE_TOKEN is not set.

Set it in this shell first:
  export GOOGLE_TOKEN="<YOUR_GOOGLE_ID_TOKEN>"

Then rerun this script.
MSG
  exit 1
fi

function curl_json() {
  local method="$1"
  local path="$2"
  local data="${3:-}"

  if [[ -n "$data" ]]; then
    curl -sS -X "$method" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$BASE_URL$path"
  else
    curl -sS -X "$method" \
      -H "Authorization: Bearer $TOKEN" \
      "$BASE_URL$path"
  fi
}

function parse_json_field() {
  local field="$1"
  node -e "
    const fs = require('fs');
    const input = fs.readFileSync(0, 'utf8');
    try {
      const obj = JSON.parse(input);
      const parts = '$field'.split('.');
      let cur = obj;
      for (const p of parts) cur = cur?.[p];
      if (cur === undefined) process.exit(2);
      if (typeof cur === 'object') {
        process.stdout.write(JSON.stringify(cur));
      } else {
        process.stdout.write(String(cur));
      }
    } catch (e) {
      process.exit(3);
    }
  "
}

function require_ok_status() {
  local json="$1"
  local label="$2"
  local status
  status=$(printf '%s' "$json" | parse_json_field status || true)
  if [[ "$status" != "ok" ]]; then
    echo "[$label] Expected status=ok, got: $json" >&2
    exit 2
  fi
}

echo "[1/6] GET /plan"
plan=$(curl_json GET "/plan")
if [[ -z "$plan" ]]; then
  echo "GET /plan returned empty response" >&2
  exit 2
fi

echo "[2/6] POST /plan/tasks (create)"
create=$(curl_json POST "/plan/tasks" '{"parentId":null,"task":{"title":"Test task","status":"Active"}}')
require_ok_status "$create" "POST /plan/tasks"
TASK_ID=$(printf '%s' "$create" | parse_json_field task.id)
if [[ -z "$TASK_ID" ]]; then
  echo "Create did not return task.id: $create" >&2
  exit 2
fi

echo "Created task id: $TASK_ID"

echo "[3/6] PUT /plan/tasks/:id (update)"
update=$(curl_json PUT "/plan/tasks/$TASK_ID" "{\"task\":{\"id\":\"$TASK_ID\",\"title\":\"Test task updated\",\"status\":\"Done\",\"tasks\":[]}}")
require_ok_status "$update" "PUT /plan/tasks/:id"

echo "[4/6] GET /plan/tasks/:id (verify update)"
read_one=$(curl_json GET "/plan/tasks/$TASK_ID")
require_ok_status "$read_one" "GET /plan/tasks/:id"
TITLE=$(printf '%s' "$read_one" | parse_json_field task.title)
STATUS=$(printf '%s' "$read_one" | parse_json_field task.status)
if [[ "$TITLE" != "Test task updated" || "$STATUS" != "Done" ]]; then
  echo "Unexpected task fields: title=$TITLE status=$STATUS raw=$read_one" >&2
  exit 2
fi

echo "[5/6] DELETE /plan/tasks/:id"
deleted=$(curl_json DELETE "/plan/tasks/$TASK_ID")
require_ok_status "$deleted" "DELETE /plan/tasks/:id"

echo "[6/6] GET /plan/tasks/:id (verify deleted)"
read_deleted=$(curl_json GET "/plan/tasks/$TASK_ID")
err=$(printf '%s' "$read_deleted" | parse_json_field error || true)
if [[ "$err" != "not_found" ]]; then
  echo "Expected not_found after delete, got: $read_deleted" >&2
  exit 2
fi

echo "All plan endpoint tests passed."
