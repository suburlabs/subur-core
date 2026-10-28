#!/bin/sh
# Entorn de rclone per al remot `s3` sense fitxer de configuració.
#
# El carreguen `backup.sh` i `restore.sh` amb `. /usr/local/bin/rclone-env.sh`,
# i també serveix per a una ordre solta dins del contenidor (runbook §9): les
# exportacions viuen totes en un sol lloc i no es poden desincronitzar. Com que
# s'hi entra amb `.`, un `exit 1` d'aquí atura també qui l'ha carregat, que és
# el que volem: amb un proveïdor desconegut no s'ha de tocar cap bucket. Un
# `S3_ENDPOINT` buit no és error: el destí pot ser local i el remot no s'usa.
#
# Remot `s3` sense fitxer de configuració (spec §23.5): qualsevol bucket
# compatible amb S3. L'endpoint és explícit (`S3_ENDPOINT`, el mateix que
# fa servir la web) i el proveïdor només serveix perquè rclone apliqui les
# seves particularitats: `Cloudflare` per a R2 (el nostre cas), `Minio`,
# `AWS` o `Other`. Es retallen els espais com fa el TypeScript de l'aplicació.
# (Mesurat a la tasca 9 del pla G, VPS, 2026-09-23: un bucket de R2 amb
# jurisdicció UE NOMÉS respon a `<compte>.eu.r2.cloudflarestorage.com`; contra
# el genèric, `403 AccessDenied`. Per això l'endpoint ha de ser el bo.)
ENDPOINT="$(printf %s "${S3_ENDPOINT:-}" | tr -d '[:space:]')"
PROVIDER="$(printf %s "${S3_PROVIDER:-}" | tr -d '[:space:]')"
PROVIDER="${PROVIDER:-Cloudflare}"
case "$PROVIDER" in
  Cloudflare|Minio|AWS|Other) ;;
  *) echo "S3_PROVIDER no válido (valores admitidos: Cloudflare, Minio, AWS, Other)" >&2; exit 1 ;;
esac

# Sense fitxer de configuració: el remot `s3` es defineix amb les variables de
# sota i no hi ha cap `rclone.conf`. Si no es diu res, rclone busca el fitxer,
# no el troba i escriu un `NOTICE: Config file … not found` a cada invocació
# (set per còpia al registre del contenidor); amb `/dev/null` calla i les
# variables `RCLONE_CONFIG_S3_*` continuen definint el remot igualment.
export RCLONE_CONFIG=/dev/null
export RCLONE_CONFIG_S3_TYPE=s3
export RCLONE_CONFIG_S3_PROVIDER="$PROVIDER"
export RCLONE_CONFIG_S3_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY_ID:-}"
export RCLONE_CONFIG_S3_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_ACCESS_KEY:-}"
export RCLONE_CONFIG_S3_ENDPOINT="$ENDPOINT"
export RCLONE_CONFIG_S3_REGION="${S3_REGION:-auto}"
export RCLONE_CONFIG_S3_ACL=private

# Mesurat a la tasca 9c del pla G (VPS, 2026-09-23): `rclone copyto` fallava
# amb `403 AccessDenied` a `CreateBucket` perquè rclone primer fa un
# HeadBucket per comprovar que el bucket existeix; un token de R2 limitat a
# buckets concrets també rep 403 en aquesta comprovació, rclone en dedueix
# que el bucket no existeix i prova de crear-lo (403 de nou). Els buckets ja
# existeixen: saltem la comprovació.
export RCLONE_CONFIG_S3_NO_CHECK_BUCKET=true

# Llistat amb estat: `rclone_lsf <ruta> [opcions]` treu la llista per la sortida
# i l'error a "$LSF_ERR", i només retorna error quan de debò no s'ha pogut
# consultar. Serveix per a no confondre «aquí no hi ha res» amb «no he pogut
# mirar-ho»: amb `[ -n "$(rclone lsf …)" ]` una fallada de xarxa, de credencials
# o de permisos es llegia com un «no existeix» i, a la neteja d'orfes, hauria
# esborrat el volcat d'una còpia bona.
# Estats mesurats amb la imatge (rclone v1.74.1): 0 llista (buida o no), 3
# carpeta inexistent, 1 configuració o remot dolents, 6 permís denegat. El 3
# compta com a llista buida: a R2 un prefix sense claus no és cap error, però en
# una carpeta local (el cicle de proves del runbook) sí, i abans de la primera
# còpia no hi ha cap `db/`.
# L'estat es recull amb `|| LSF_ST=$?`, no amb un `$?` després de l'ordre: així
# la funció es comporta igual a qualsevol shell. Amb la forma nua, dins d'un
# `$( )` d'un `if !` el `set -e` mata la subshell abans d'arribar a mirar
# l'estat en tot shell que no sigui l'ash de BusyBox, i un 3 (carpeta que no hi
# és) es convertiria en «no s'ha pogut consultar».
LSF_ERR="${LSF_ERR:-/dev/null}"
rclone_lsf() {
  LSF_ST=0
  rclone lsf "$@" 2>"$LSF_ERR" || LSF_ST=$?
  [ "$LSF_ST" -eq 0 ] || [ "$LSF_ST" -eq 3 ]
}
