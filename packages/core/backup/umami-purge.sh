#!/bin/sh
# deploy/backup/umami-purge.sh — purga de la base d'Umami a 25 mesos (spec §22.6, §24.9).
# El crida backup.sh després de la còpia programada (BACKUP_POST_HOOK).
# Només recomptes al registre: mai cap identificador.
set -eu
: "${DATABASE_URL:?falta DATABASE_URL}"
MONTHS="${UMAMI_PURGE_MONTHS:-25}"
case "$MONTHS" in *[!0-9]*|0*) echo "UMAMI_PURGE_MONTHS no válido (entero positivo)" >&2; exit 1 ;; esac

# Es dóna per bo que el created_at d'event_data i session_data segueix el de l'esdeveniment i la sessió: esborrar per data pròpia no deixa òrfenes a la pràctica.
# Primera sentència: dades i esdeveniments vells. Les CTE de modificació d'una
# mateixa sentència veuen la instantània anterior, per això la sessió s'esborra
# en una segona sentència, quan els esdeveniments ja no hi són.
FIRST=$(psql -v ON_ERROR_STOP=1 -tA "$DATABASE_URL" <<SQL
with d1 as (delete from event_data where created_at < now() - interval '$MONTHS months' returning 1),
     d2 as (delete from website_event where created_at < now() - interval '$MONTHS months' returning 1),
     d3 as (delete from session_data where created_at < now() - interval '$MONTHS months' returning 1)
select (select count(*) from d1) || ' ' || (select count(*) from d2) || ' ' || (select count(*) from d3);
SQL
)
# Segona: només les sessions velles que ja no tenen cap esdeveniment.
SESSIONS=$(psql -v ON_ERROR_STOP=1 -tA "$DATABASE_URL" <<SQL
with d4 as (delete from session s where s.created_at < now() - interval '$MONTHS months'
            and not exists (select 1 from website_event e where e.session_id = s.session_id) returning 1)
select count(*) from d4;
SQL
)
set -- $FIRST
echo "Purga Umami: event_data=$1 website_event=$2 session_data=$3 session=$SESSIONS"
