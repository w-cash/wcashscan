#!/usr/bin/env bash
set -euo pipefail

app_user="${APP_DB_USER:-wcashscan}"
app_password="${APP_DB_PASSWORD:-changeme}"

if ! [[ "$app_user" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    echo "ERROR: APP_DB_USER is not a valid PostgreSQL role name" >&2
    exit 1
fi

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set=ON_ERROR_STOP=1 \
    --set=app_user="$app_user" \
    --set=app_password="$app_password" <<'SQL'
SELECT format(
  'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE',
  :'app_user',
  :'app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec
SQL

# The vendored pg_dump schema keeps the original upstream owner role on a
# small set of tables and sequences.  Keep that owner role non-login, then
# grant it to the application role so a clean disposable database can load
# the schema without silently rewriting provenance in the dump.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --set=ON_ERROR_STOP=1 \
    --set=app_user="$app_user" <<'SQL'
SELECT 'CREATE ROLE zcash_user NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'zcash_user')
\gexec

GRANT zcash_user TO :"app_user";
SQL
