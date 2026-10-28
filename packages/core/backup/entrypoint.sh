#!/bin/sh
set -eu

# Sense arguments: programa les còpies i es queda en marxa.
# Amb arguments: executa l'ordre (p. ex. `backup.sh` o `restore.sh <còpia>`).
if [ "$#" -gt 0 ]; then
  exec "$@"
fi

# Un sol `cron`, diari a les 03:00 (spec §24.7): `backup.sh --scheduled` decideix
# si avui toca segons BACKUP_EVERY (de l'entorn: derivat de .subur/ pel client,
# fix al compose per a la plataforma), i després d'una còpia bona hi crida BACKUP_POST_HOOK si n'hi ha.
# crond no passa l'entorn del contenidor a les tasques: es desa (amb cometes,
# per si algun valor porta caràcters especials) i la tasca l'exporta abans de
# cridar backup.sh.
# El nom de la variable ha d'admetre xifres (`S3_ENDPOINT`, `BACKUP_S3_*`):
# amb `[A-Z_]*` la cometa d'obertura no s'hi posava i la línia quedava
# desaparellada, cosa que trencava el `.` de la tasca.
# El fitxer porta credencials i la cadena de connexió: es crea dins d'un
# subshell amb `umask 077`, de manera que neix ja amb permisos 600. Un `chmod`
# posterior arriba tard —entre la redirecció i el `chmod` el fitxer és
# llegible per tothom— i per això no n'hi ha cap.
(
  umask 077
  # BACKUP_SKIP_MEDIA (pla H2, servei de plataforma sense fitxers pujats) ha
  # de viatjar aquí igual que la resta: sense ell, backup.sh l'hauria de
  # rebre buit sota crond i tornaria a exigir S3_BUCKET encara que el
  # contenidor el tingui fixat a `1`.
  # BACKUP_TARGET, UPLOADS_SOURCE i MEDIA_OWNER (compose del paquet de
  # traspàs, spec §23.4): amb una carpeta com a destí, sense ells backup.sh
  # tornaria sota crond al bucket per defecte (`s3:${BACKUP_S3_BUCKET}`) i
  # fallaria o copiaria on no toca. A la plataforma no hi són i res no canvia.
  env | grep -E '^(DATABASE_URL|S3_[A-Z_]+|BACKUP_S3_[A-Z_]+|BACKUP_TARGET|UPLOADS_SOURCE|MEDIA_OWNER|BACKUP_EVERY|BACKUP_KEEP|BACKUP_POST_HOOK|BACKUP_SKIP_MEDIA|BACKUP_HEARTBEAT_URL|TZ)=' \
    | sed "s/'/'\\\\''/g; s/^\([A-Z0-9_]*\)=/\1='/; s/\$/'/" > /etc/backup.env
)
echo "0 3 * * * set -a; . /etc/backup.env; set +a; /usr/local/bin/backup.sh --scheduled >> /proc/1/fd/1 2>&1" > /etc/crontabs/root
echo "Copias programadas cada día a las 03:00 (BACKUP_EVERY=${BACKUP_EVERY:?falta BACKUP_EVERY}, BACKUP_KEEP=${BACKUP_KEEP:?falta BACKUP_KEEP})"
exec crond -f -l 8
