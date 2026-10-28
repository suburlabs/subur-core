#!/bin/sh
set -eu

# Entorn de rclone per al remot `s3`, compartit amb restore.sh.
. /usr/local/bin/rclone-env.sh

# Rutes rclone. Les proves locals les sobreescriuen amb carpetes.
TARGET="${BACKUP_TARGET:-s3:${BACKUP_S3_BUCKET:?falta BACKUP_S3_BUCKET}}"
# Una base sense fitxers pujats (Umami, pla H2) es copia sense `media/`.
SKIP_MEDIA="${BACKUP_SKIP_MEDIA:-0}"
if [ "$SKIP_MEDIA" = 1 ]; then
  UPLOADS=""
else
  UPLOADS="${UPLOADS_SOURCE:-s3:${S3_BUCKET:?falta S3_BUCKET}}"
fi
: "${DATABASE_URL:?falta DATABASE_URL}"

SCHEDULED=0
[ "${1:-}" = "--scheduled" ] && SCHEDULED=1

# «El contracte mana» (spec §25.4): la cadència i la retenció arriben per
# l'entorn, que `pnpm ops deploy` deriva de `.subur/operations.json` (el client)
# o que fixa el compose (la plataforma, el paquet de traspàs). Sense valors no
# es fa cap còpia: el heartbeat no arriba i el monitor avisa.
EVERY="${BACKUP_EVERY:?falta BACKUP_EVERY (daily, weekly o monthly): el desplegament no ha escrit l'entorn de còpies}"
KEEP="${BACKUP_KEEP:?falta BACKUP_KEEP (còpies programades que es conserven)}"
case "$EVERY" in daily|weekly|monthly) ;; *) echo "BACKUP_EVERY no válido: valores admitidos daily, weekly, monthly" >&2; exit 1 ;; esac
# `BACKUP_KEEP=0` esborraria la còpia que s'acaba de fer; un valor no numèric
# trencaria l'aritmètica de `tail`.
case "$KEEP" in ''|*[!0-9]*|0) echo "BACKUP_KEEP no válido: entero ≥ 1" >&2; exit 1 ;; esac

# Programada (el `cron` diari d'entrypoint.sh): només el dia que toca. Manual
# (sense `--scheduled`: el runbook, el traspàs): sempre. Quan no toca se surt
# abans d'instal·lar el `trap`: no s'ha intentat cap còpia i no hi ha latido.
# BACKUP_DAY (dia del mes, `01`–`31`) només el fan servir els tests.
if [ "$SCHEDULED" = 1 ]; then
  DAY="${BACKUP_DAY:-$(date -u +%d)}"
  DOW="$(date -u +%u)"
  case "$EVERY" in
    monthly) [ "$DAY" = 01 ] || { echo "Hoy no toca copia (plan mensual)"; exit 0; } ;;
    weekly) [ "$DOW" = 7 ] || { echo "Hoy no toca copia (plan semanal)"; exit 0; } ;;
  esac
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
WORK="$(mktemp -d)"
DUMP="$WORK/$STAMP.dump"
STATUS=fail
# On el `rclone_lsf` de rclone-env.sh deixa l'error de l'última consulta.
LSF_ERR="$WORK/lsf.err"

heartbeat() {
  if [ -n "${BACKUP_HEARTBEAT_URL:-}" ]; then
    # La URL del servei de monitoratge pot portar ja una cadena de consulta
    # (`…/ping?uuid=…`): afegir-hi `?` la trencaria. El separador es tria.
    case "$BACKUP_HEARTBEAT_URL" in *\?*) SEP='&' ;; *) SEP='?' ;; esac
    # La URL porta el token del lloc: al registre només hi va el que s'envia, i
    # l'error de curl (que en citaria l'adreça) es canvia pel seu codi de sortida.
    echo "Latido: status=$STATUS stamp=$STAMP every=$EVERY"
    curl -fs -m 10 -o /dev/null "${BACKUP_HEARTBEAT_URL}${SEP}status=$STATUS&stamp=$STAMP&every=$EVERY" \
      || echo "Latido no enviado (curl: código $?)" >&2
  fi
}
cleanup() { rm -rf "$WORK"; heartbeat; }
trap cleanup EXIT

# 1. Volcat i comprovació d'integritat (l'equivalent del PRAGMA integrity_check d'abans).
#    `--no-owner` no fa res en format custom (pg_dump només l'aplica al text
#    pla). `--no-privileges` sí que hi fa: descarta les entrades ACL de l'arxiu.
#    Es deixa a `pg_restore`, que el torna a aplicar en restaurar, i així l'arxiu
#    conserva els ACL (una còpia ha de guardar-ho tot; qui tria què s'aplica és
#    la restauració).
# La memòria cau de Next (spec §26.3) es desa amb l'esquema i sense dades: la restauració comença amb la cau buida.
pg_dump --format=custom --exclude-table-data=next_cache --exclude-table-data=next_cache_tags --file="$DUMP" "$DATABASE_URL"
pg_restore --list "$DUMP" > /dev/null

# 2. Pujada i verificació. La marca `.ok` només s'escriu quan tot ha anat bé:
#    una còpia sense `.ok` és una còpia interrompuda i restore.sh no la tria mai.
#    Abans de pujar res, la marca ha d'estar lliure: dues execucions dins del
#    mateix segon comparteixen `STAMP` i `copyto` sobreescriuria en silenci la
#    còpia de l'altra. Aquí sí que toca sortir amb error (i amb senyal `fail`).
if ! TAKEN="$(rclone_lsf "$TARGET/db/" --include "$STAMP.dump")"; then
  echo "No se pudo consultar la copia: $(head -1 "$LSF_ERR")" >&2
  exit 1
fi
if [ -n "$TAKEN" ]; then
  echo "Ya existe una copia con la marca $STAMP: espere un segundo y repita" >&2
  exit 1
fi

rclone copyto "$DUMP" "$TARGET/db/$STAMP.dump"
rclone check "$WORK" "$TARGET/db" --one-way --include "$STAMP.dump"
# Una còpia manual porta la marca de la seva cua (`.manual`) al costat del `.ok`,
# i s'escriu abans: una còpia acabada no apareix mai sense saber de quina cua és.
if [ "$SCHEDULED" != 1 ]; then
  printf '%s\n' "$STAMP" > "$WORK/$STAMP.manual"
  rclone copyto "$WORK/$STAMP.manual" "$TARGET/db/$STAMP.manual"
fi
printf '%s\n' "$STAMP" > "$WORK/$STAMP.ok"
rclone copyto "$WORK/$STAMP.ok" "$TARGET/db/$STAMP.ok"
echo "Copia $STAMP hecha"

# 3. Fitxers pujats: còpia de servidor a servidor dins de R2 (no passa pel VPS).
#    Una base sense fitxers pujats (Umami, pla H2) no en té cap per copiar.
if [ "$SKIP_MEDIA" != 1 ]; then
  rclone sync "$UPLOADS" "$TARGET/media"
  echo "Copia $STAMP: archivos sincronizados"
else
  echo "Copia $STAMP: sin archivos (BACKUP_SKIP_MEDIA=1)"
fi

# 4. Retenció, en dues cues (spec §24.7). Les programades (`--scheduled`)
#    conserven les $KEEP més recents (BACKUP_KEEP). Les manuals (el
#    runbook, `ops deploy`, l'alta, la prova de restauració, el traspàs) porten
#    `db/<MARCA>.manual` i se'n conserven les 3 més recents, sempre: tres
#    desplegaments en un mes no poden retirar l'historial mensual d'un Starter.
#    Cada execució només retira de la seva cua: cap còpia no surt per fer lloc
#    a una de l'altra. Una còpia sense `.manual` (també les d'abans d'aquest
#    canvi) compta com a programada. Si no es poden llistar les marques, no es
#    retira res: sense la llista de `.manual`, totes semblarien programades.
#    Cap esborrat de la retenció pot fer fracassar una còpia que ja és bona: si
#    el bucket es posa tossut, els `deletefile` toleren l'error (si no, el
#    senyal de vida diria `fail` amb la còpia acabada de pujar i verificada).
MANUAL_KEEP=3
if [ "$SCHEDULED" = 1 ]; then MINE=scheduled QUEUE_KEEP="$KEEP"; else MINE=manual QUEUE_KEEP="$MANUAL_KEEP"; fi
if OKS="$(rclone_lsf "$TARGET/db/" --include '*.ok')" && MANUALS="$(rclone_lsf "$TARGET/db/" --include '*.manual')"; then
  printf '%s\n' "$OKS" | sed -n 's/\.ok$//p' | sort -r | while read -r copy; do
    if printf '%s\n' "$MANUALS" | grep -qxF "$copy.manual"; then queue=manual; else queue=scheduled; fi
    if [ "$queue" = "$MINE" ]; then echo "$copy"; fi
  done | tail -n +"$((QUEUE_KEEP + 1))" | while read -r old; do
    rclone deletefile "$TARGET/db/$old.dump" || true
    rclone deletefile "$TARGET/db/$old.ok" || true
    if [ "$MINE" = manual ]; then rclone deletefile "$TARGET/db/$old.manual" || true; fi
    echo "Copia $old retirada"
  done
else
  echo "No se pudo listar las copias: $(head -1 "$LSF_ERR"); no se retira ninguna" >&2
fi
#    La marca es busca llistant la carpeta amb `--include`, no pas amb el codi
#    de sortida d'un `lsf` sobre la ruta del fitxer: a S3/R2 una clau que no hi
#    és no és cap error (es tracta com un prefix buit i `lsf` surt amb 0), i el
#    volcat interromput no s'esborraria mai. Amb la sortida buida sí que es veu.
#    Un volcat sense `.ok` també pot ser d'una còpia concurrent que encara no ha
#    escrit la marca: només es retiren els que porten més de deu minuts. El
#    `date` de la imatge (BusyBox) no fa dates relatives —`-d '-10 minutes'` és
#    un error— però sí `-d '@<epoch>'`, i el format de la marca s'ordena
#    alfabèticament, de manera que la comparació de cadenes ja és cronològica.
#    Amb `|| LIMIT=''` no hi ha cap ordre en tot aquest bloc que pugui matar
#    l'script (`set -e`) amb la còpia ja feta: sense límit no es retira cap orfe.
LIMIT="$(date -u -d "@$(( $(date -u +%s) - 600 ))" +%Y%m%dT%H%M%SZ)" || LIMIT=''
rclone lsf "$TARGET/db" --include '*.dump' | sed 's/\.dump$//' | while read -r dump; do
  [ "$dump" = "$STAMP" ] && continue
  # shellcheck disable=SC3012 # el `<` de cadenes no és POSIX però sí del test de BusyBox (comprovat a la imatge)
  [ "$dump" \< "$LIMIT" ] || continue
  # Si `lsf` no pot respondre (xarxa, credencials) no es retira res: donar
  # l'error per «no hi ha `.ok`» esborraria el volcat d'una còpia bona. I com
  # la resta de la retenció, no pot fer fracassar la còpia que s'acaba de fer.
  if ! MARK="$(rclone_lsf "$TARGET/db/" --include "$dump.ok")"; then
    echo "No se pudo consultar la copia $dump: $(head -1 "$LSF_ERR"); no se retira nada" >&2
    continue
  fi
  [ -n "$MARK" ] && continue
  { rclone deletefile "$TARGET/db/$dump.dump" && echo "Copia $dump (interrumpida) retirada"; } || true
  # La marca de cua d'una manual interrompuda (si n'hi ha) se'n va amb el volcat.
  if MANUAL="$(rclone_lsf "$TARGET/db/" --include "$dump.manual")" && [ -n "$MANUAL" ]; then
    rclone deletefile "$TARGET/db/$dump.manual" || true
  fi
done

STATUS=ok

# 5. Tasca posterior (BACKUP_POST_HOOK, p. ex. la purga d'Umami a la plataforma):
#    només després d'una còpia programada bona. Es crida d'aquí i no del `cron`
#    perquè «avui no toca» també surt amb 0 i el `cron` no ho distingiria. Si
#    falla, ho diu, però la còpia ja és bona i el latido continua sent `ok`.
if [ "$SCHEDULED" = 1 ] && [ -n "${BACKUP_POST_HOOK:-}" ]; then
  "/usr/local/bin/$BACKUP_POST_HOOK" || echo "La tarea posterior $BACKUP_POST_HOOK ha fallado" >&2
fi
