# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# Tarballs locals del nucli (`file:./vendor/*.tgz`: l'acceptació del CI del nucli i qualsevol prova fora de npm): normalment
# només hi ha README.md.
COPY vendor ./vendor
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SERVER_URL
ARG NEXT_PUBLIC_UMAMI_WEBSITE_ID=
ARG NEXT_PUBLIC_UMAMI_SCRIPT_URL=
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL \
    NEXT_PUBLIC_UMAMI_WEBSITE_ID=$NEXT_PUBLIC_UMAMI_WEBSITE_ID \
    NEXT_PUBLIC_UMAMI_SCRIPT_URL=$NEXT_PUBLIC_UMAMI_SCRIPT_URL \
    NEXT_TELEMETRY_DISABLED=1
# El build carrega la configuració del CMS, que exigeix un secret i una URL de
# base de dades que mai es fa servir: el build no hi connecta (el port 1 no
# escolta res). Cap dels dos s'usa en temps d'execució ni es desa a la imatge final.
# Les pàgines públiques es generen a la primera visita (`generateStaticParams`
# torna `[]`), de manera que el build no consulta ni congela cap contingut de la
# base de dades;
# les migracions de producció tampoc corren en aquesta fase (`shouldRunMigrations` de @suburlabs/core/config).
RUN SUBUR_SECRET=build-only DATABASE_URL=postgres://build-only:x@127.0.0.1:1/build_only pnpm build

FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# En producció R2 és obligatori (`disableLocalStorage`), de manera que el
# `staticDir` de `media` no s'usa mai; el directori queda només perquè
# `/public` es serveix tal com surt del build.
RUN mkdir -p ./public/media && chown -R nextjs:nodejs ./public/media
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
