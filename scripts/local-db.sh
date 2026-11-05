#!/bin/bash
# The Mac's own Postgres for big passes: Postgres 17 from Homebrew, no Docker.
# It listens only on this computer, on its own port, in its own folder, and never
# touches any other Postgres on the machine. It holds a disposable catalogue copy
# without personal data, which is why local connections need no password.
#
#   bash scripts/local-db.sh start | stop | status | restore | reset
set -euo pipefail
# Without a valid locale here, Postgres on macOS refuses to start ("became multithreaded").
export LC_ALL=en_US.UTF-8

PG_BIN="${LOCAL_PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
PORT="${LOCAL_PG_PORT:-54329}"
DATA="${LOCAL_PG_DATA:-$HOME/Library/Application Support/LetsRace/data/local-postgres}"
DATABASE="letsrace"
LOG="$DATA/server.log"

psql_local() { "$PG_BIN/psql" -h 127.0.0.1 -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -qAt "$@"; }
running() { "$PG_BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; }

initialise() {
  mkdir -p "$(dirname "$DATA")"
  "$PG_BIN/initdb" -D "$DATA" -U postgres --encoding=UTF8 --locale=C.UTF-8 --auth-local=trust --auth-host=trust >/dev/null
  cat >> "$DATA/postgresql.conf" <<EOF

# LetsRace local pass: this computer only, tuned for parallel workers on 16 GB.
listen_addresses = '127.0.0.1'
port = $PORT
unix_socket_directories = ''
max_connections = 60
shared_buffers = 1GB
effective_cache_size = 4GB
work_mem = 32MB
maintenance_work_mem = 256MB
max_wal_size = 4GB
EOF
}

prepare_database() {
  psql_local -d postgres -c "create database $DATABASE" 2>/dev/null || true
  # The same role names as Supabase, so restored grants and policies keep their meaning.
  psql_local -d "$DATABASE" <<'SQL'
create schema if not exists extensions;
do $$
declare role_name text;
begin
  foreach role_name in array array['anon', 'authenticated'] loop
    if not exists (select 1 from pg_roles where rolname = role_name) then execute format('create role %I nologin', role_name); end if;
  end loop;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator login noinherit; end if;
  -- Named by restored grants and default privileges; they log in to nothing here.
  foreach role_name in array array['supabase_admin', 'supabase_auth_admin'] loop
    if not exists (select 1 from pg_roles where rolname = role_name) then execute format('create role %I nologin', role_name); end if;
  end loop;
end $$;
grant anon, authenticated, service_role to authenticator;
-- Stand-ins for Supabase's login system. The copy holds no accounts, so nobody is signed in.
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as 'select null::uuid';
grant usage on schema auth to anon, authenticated, service_role;
-- Where the server keeps it: restored columns name public.geography.
create extension if not exists postgis schema public;
create extension if not exists pg_trgm schema extensions;
create extension if not exists unaccent schema extensions;
create extension if not exists fuzzystrmatch schema extensions;
create extension if not exists "uuid-ossp" schema extensions;
create extension if not exists pgcrypto schema extensions;
-- Supabase grants these itself, so the structure dump does not contain them.
grant usage on schema extensions to anon, authenticated, service_role;
grant execute on all functions in schema extensions to anon, authenticated, service_role;
grant select on table public.spatial_ref_sys to anon, authenticated, service_role;
SQL
}

# Rebuild the working copy from the saved server files, and keep an untouched twin
# next to it. Comparing the two later shows exactly what a pass changed.
restore_copy() {
  local copy="$(dirname "$DATA")/local-copy" drop
  [ -f "$copy/schema.sql" ] && [ -f "$copy/catalogue-baseline.dump" ] || { echo "No saved copy in $copy" >&2; exit 1; }
  running || "$PG_BIN/pg_ctl" -D "$DATA" -l "$LOG" -w start >/dev/null
  for drop in "$DATABASE" "${DATABASE}_baseline"; do
    psql_local -d postgres -c "drop database if exists $drop with (force)"
  done
  prepare_database
  psql_local -d "$DATABASE" -v ON_ERROR_STOP=0 -f "$copy/schema.sql" > "$copy/restore.log" 2>&1 || true
  "$PG_BIN/pg_restore" -h 127.0.0.1 -p "$PORT" -U postgres -d "$DATABASE" --data-only --disable-triggers --no-owner "$copy/catalogue-baseline.dump" > "$copy/data-restore.log" 2>&1 || { echo "Data restore failed; see $copy/data-restore.log" >&2; exit 1; }
  psql_local -d "$DATABASE" -c "analyze"
  # The interface holds connections open, and a template needs none.
  pkill -f "postgrest .*local-api/postgrest.conf" 2>/dev/null || true
  psql_local -d postgres -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = '$DATABASE'" >/dev/null
  psql_local -d postgres -c "create database ${DATABASE}_baseline template $DATABASE"
  echo "Working copy restored; untouched twin is ${DATABASE}_baseline"
}

case "${1:-status}" in
  start)
    [ -f "$DATA/PG_VERSION" ] || initialise
    running || "$PG_BIN/pg_ctl" -D "$DATA" -l "$LOG" -w start >/dev/null
    prepare_database
    echo "Local Postgres is running on 127.0.0.1:$PORT, database $DATABASE"
    ;;
  restore) restore_copy ;;
  stop)
    pkill -f "postgrest .*local-api/postgrest.conf" 2>/dev/null || true
    if running; then "$PG_BIN/pg_ctl" -D "$DATA" -m fast -w stop >/dev/null; fi
    echo "Local Postgres is stopped"
    ;;
  status)
    if running; then
      psql_local -d "$DATABASE" -c "select version(); select extname, extversion from pg_extension order by 1; select pg_size_pretty(pg_database_size(current_database()))"
    else
      echo "Local Postgres is stopped"
    fi
    ;;
  reset)
    # Only ever removes this script's own folder.
    if running; then "$PG_BIN/pg_ctl" -D "$DATA" -m fast -w stop >/dev/null; fi
    [ -f "$DATA/PG_VERSION" ] && rm -rf "$DATA"
    echo "Local copy removed; start creates a new one"
    ;;
  *) echo "Usage: local-db.sh start|stop|status|restore|reset" >&2; exit 1 ;;
esac
