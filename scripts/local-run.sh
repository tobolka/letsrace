#!/bin/bash
# Run any command against the Mac's catalogue copy instead of the server.
#
#   bash scripts/local-run.sh node scripts/with-node.cjs ./node_modules/tsx/dist/cli.mjs scripts/reload-calendars.ts --rounds=1 --limit=5
#
# Server, mail and publication credentials are blanked here, and local-guard.cjs
# stops any process that tries to reach them. LOCAL_ALLOW_AI=1 keeps the AI key.
set -euo pipefail
cd "$(dirname "$0")/.."
export LC_ALL=en_US.UTF-8

STATE="${LOCAL_PG_DATA:-$HOME/Library/Application Support/LetsRace/data/local-postgres}/../local-api"
POSTGREST_PORT=54330
API_PORT=54331
mkdir -p "$STATE"
chmod 700 "$STATE"

bash scripts/local-db.sh start >/dev/null 2>&1

SECRET_FILE="$STATE/jwt-secret"
if [ ! -s "$SECRET_FILE" ]; then
  (umask 077; openssl rand -hex 32 > "$SECRET_FILE")
fi
SECRET="$(cat "$SECRET_FILE")"

listening() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

if ! listening "$POSTGREST_PORT"; then
  cat > "$STATE/postgrest.conf" <<EOF
db-uri = "postgres://authenticator@127.0.0.1:54329/letsrace"
db-schemas = "public"
db-anon-role = "anon"
db-pool = 30
server-host = "127.0.0.1"
server-port = $POSTGREST_PORT
jwt-secret = "$SECRET"
EOF
  chmod 600 "$STATE/postgrest.conf"
  nohup postgrest "$STATE/postgrest.conf" >> "$STATE/postgrest.log" 2>&1 &
fi
if ! listening "$API_PORT"; then
  LOCAL_API_PORT="$API_PORT" LOCAL_POSTGREST_PORT="$POSTGREST_PORT" nohup node scripts/local-api.cjs >> "$STATE/api.log" 2>&1 &
fi
for _ in $(seq 1 50); do
  if listening "$POSTGREST_PORT" && listening "$API_PORT"; then break; fi
  sleep 0.2
done
listening "$POSTGREST_PORT" && listening "$API_PORT" || { echo 'Local database interface did not start'; exit 1; }

SERVICE_KEY="$(SECRET="$SECRET" node -e '
const { createHmac } = require("node:crypto");
const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
const body = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role: "service_role", exp: Math.floor(Date.now() / 1000) + 7 * 86400 })}`;
console.log(`${body}.${createHmac("sha256", process.env.SECRET).update(body).digest("base64url")}`);
')"

# Scripts read .env.local with ??=, so a value set here, even an empty one, wins over the file.
export NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:$API_PORT"
export SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$SERVICE_KEY"
export SUPABASE_DB_URL=""
export RESEND_API_KEY=""
export CRON_SECRET=""
if [ "${LOCAL_ALLOW_AI:-0}" != "1" ]; then
  export ANTHROPIC_API_KEY="" OPENAI_API_KEY="" LLM_CALENDARS=0 LLM_DAILY=0 LLM_BUDGET_USD=0
fi
export LETSRACE_LOCAL_PASS=1
# The same switches as the Mac's normal cycle (refresh-data.sh), so results are comparable.
export CATALOG_OVERVIEW_ONLY="${CATALOG_OVERVIEW_ONLY:-1}" PIPELINE_REVIEW_QUEUE="${PIPELINE_REVIEW_QUEUE:-1}"
export CATALOG_COUNTRIES="${PIPELINE_TARGET_COUNTRIES:-CZ,SK,AT,DE,PL,CH,IT}"
# Quoted: the managed copy lives under "Application Support", and an unquoted path with
# a space stops every Node process here before it reads a single source.
export NODE_OPTIONS="--require \"$PWD/scripts/local-guard.cjs\" ${NODE_OPTIONS:-}"
exec "$@"
