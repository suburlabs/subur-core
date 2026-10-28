# Mateixa versió major de Postgres que la plataforma: pg_dump i pg_restore han
# de ser de la mateixa versió que el servidor.
FROM postgres:17-alpine
RUN apk add --no-cache rclone curl tzdata
COPY entrypoint.sh backup.sh restore.sh rclone-env.sh umami-purge.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/backup.sh /usr/local/bin/restore.sh \
  /usr/local/bin/rclone-env.sh /usr/local/bin/umami-purge.sh
# L'ARG va després del FROM (un ARG abans del FROM no arriba al LABEL) i en últim lloc: així cap capa no depèn de la versió.
ARG VERSION=dev
LABEL org.opencontainers.image.version=$VERSION org.opencontainers.image.source=https://github.com/suburlabs/subur-core
ENTRYPOINT ["entrypoint.sh"]
