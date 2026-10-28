#!/bin/sh
set -eu

STAMP="${1:?Indique la copia que quiere restaurar (marca de tiempo, p. ej. 20260922T030000Z)}"
shift
MEDIA=0
FORCE=0
for arg in "$@"; do
  case "$arg" in
    --media) MEDIA=1 ;;
    --force) FORCE=1 ;;
    *) echo "Argumento desconocido: $arg"; exit 1 ;;
  esac
done

# Una base sense fitxers pujats (Umami, pla H2) rebutja `--media` abans de
# tocar res més (ni tan sols de carregar l'entorn de rclone).
SKIP_MEDIA="${BACKUP_SKIP_MEDIA:-0}"
if [ "$MEDIA" -eq 1 ] && [ "$SKIP_MEDIA" = 1 ]; then
  echo "Esta copia no tiene archivos (BACKUP_SKIP_MEDIA=1): --media no procede" >&2
  exit 1
fi

# Entorn de rclone per al remot `s3`, compartit amb backup.sh.
. /usr/local/bin/rclone-env.sh
TARGET="${BACKUP_TARGET:-s3:${BACKUP_S3_BUCKET:?falta BACKUP_S3_BUCKET}}"
if [ "$SKIP_MEDIA" = 1 ]; then
  UPLOADS=""
else
  UPLOADS="${UPLOADS_SOURCE:-s3:${S3_BUCKET:?falta S3_BUCKET}}"
fi
: "${DATABASE_URL:?falta DATABASE_URL}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
# On el `rclone_lsf` de rclone-env.sh deixa l'error de l'última consulta.
LSF_ERR="$WORK/lsf.err"

# Una còpia sense `.ok` és una còpia interrompuda: no es restaura mai. Es mira
# la sortida de `lsf` sobre la carpeta, no el codi de sortida sobre la ruta del
# fitxer: a S3/R2 una clau que no hi és no és cap error (`lsf` la tracta com un
# prefix buit i surt amb 0), i el guard deixaria passar un volcat interromput.
# L'estat de `lsf` sí que es mira, a part (`rclone_lsf`, a rclone-env.sh): si no
# s'ha pogut consultar el dipòsit (xarxa, credencials, permisos) no es pot dir
# que la còpia no hi sigui, i el missatge ha de portar l'operador a mirar la
# connexió i no pas a buscar una altra marca.
if ! MARK="$(rclone_lsf "$TARGET/db/" --include "$STAMP.ok")"; then
  echo "No se pudo consultar la copia $STAMP: $(head -1 "$LSF_ERR")" >&2
  exit 1
fi
[ -n "$MARK" ] || {
  echo "La copia $STAMP no existe o está incompleta (sin marca .ok) en $TARGET: restauración cancelada, no se ha tocado nada"
  # Un `BACKUP_TARGET` mal escrit també arriba aquí (rclone diu «directory not
  # found», estat 3, que compta com a llista buida): si `lsf` ha deixat un
  # error, es diu, perquè l'operador miri la ruta i no es posi a buscar una
  # altra marca. L'estat de `rclone_lsf` no es pot llegir des d'aquí —la funció
  # s'executa dins d'un `$( )`, que és una subshell— però el fitxer sí.
  [ -s "$LSF_ERR" ] && echo "Detalle: $(head -1 "$LSF_ERR")"
  exit 1
}

# Amb `--media`, `sync` esborra al destí tot allò que no és a l'origen: un
# prefix `media/` buit o absent buidaria el bucket d'imatges del client. Es
# comprova ABANS de res (com feia el `tar -tzf` de la versió de SQLite), no
# just abans del `sync`, perquè la base de dades tampoc s'arribi a tocar.
if [ "$MEDIA" -eq 1 ]; then
  # `--max-depth 1` és suficient mentre les pujades siguin planes (el remot del
  # bucket d'imatges no porta `prefix`): els fitxers pengen de l'arrel de
  # `media/`. Amb subcarpetes caldria treure'l, o el prefix ple semblaria buit.
  if ! MEDIA_LIST="$(rclone_lsf "$TARGET/media" --max-depth 1)"; then
    echo "No se pudo consultar la copia $STAMP (archivos): $(head -1 "$LSF_ERR")" >&2
    exit 1
  fi
  [ -n "$MEDIA_LIST" ] || {
    echo "La copia $STAMP no tiene archivos guardados (media vacío): restauración cancelada, no se ha tocado nada"
    exit 1
  }
fi

# Servei que escriu a la base i que cal aturar abans de restaurar: `web` als
# clients, `umami` a la plataforma (el compose de la plataforma hi posa
# BACKUP_APP_SERVICE=umami).
APP_SERVICE="${BACKUP_APP_SERVICE:-web}"

# No hi ha manera de saber des d'aquí si el servei segueix escrivint; es demana
# una confirmació explícita perquè l'operador l'hagi aturat abans (vegeu el runbook).
if [ "$FORCE" -ne 1 ]; then
  echo "Esto va a sustituir la base de datos actual por la copia $STAMP$( [ "$MEDIA" -eq 1 ] && echo ' y los archivos subidos por los de esa copia')."
  echo "Compruebe que ya ha parado el servicio $APP_SERVICE (docker compose stop $APP_SERVICE)."
  printf 'Escriba SI para confirmar: '
  read -r CONFIRM
  [ "$CONFIRM" = "SI" ] || { echo "Restauración cancelada"; exit 1; }
fi

rclone copyto "$TARGET/db/$STAMP.dump" "$WORK/$STAMP.dump"
pg_restore --list "$WORK/$STAMP.dump" > /dev/null

# Tot o res: si falla a mig camí, la base queda com estava.
pg_restore --clean --if-exists --single-transaction --no-owner --no-privileges \
  --dbname="$DATABASE_URL" "$WORK/$STAMP.dump"
echo "Copia $STAMP restaurada (base de datos)"

if [ "$MEDIA" -eq 1 ]; then
  rclone sync "$TARGET/media" "$UPLOADS"
  # Destí de fitxers local (el compose del paquet de traspàs, spec §23.4): els
  # fitxers han de ser de l'usuari del contenidor `web` (1001), no de root.
  # (`*:*` és un remot de rclone; una ruta local no porta `:`.)
  case "$UPLOADS" in
    *:*) ;;
    *) [ -n "${MEDIA_OWNER:-}" ] && chown -R "$MEDIA_OWNER" "$UPLOADS" ;;
  esac
  echo "Copia $STAMP restaurada (archivos subidos)"
fi

echo "Vuelva a arrancar el servicio $APP_SERVICE."
