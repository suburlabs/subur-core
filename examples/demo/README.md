# Demo

Web de mostra del nucli (`@suburlabs/core`): una empresa de reformes inventada, «Reformes Exemple», a `demo.example`. Fa servir el paquet com ho farà un client i serveix per construir-lo, provar-lo i generar-ne les migracions (`pnpm -C ../.. migrate:create`).

`.subur/` és una fixture escrita a mà: en un repo de client el genera `subur-business` i no s'edita.

## En local

```bash
docker exec <contenidor-postgres> createdb -U subur subur_demo_dev   # la base de la demo, mai la d'una altra web
cp .env.example .env
pnpm -C ../.. install && pnpm -C ../.. build                         # el paquet, des del workspace
pnpm -s exec subur migrate
pnpm seed                                                            # preseed: la guarda de la base i subur sync
pnpm dev                                                             # http://localhost:3200
```

El `seed` i el `dev` no necessiten cap `subur sync` previ: els fitxers generats (i el mapa d'imports del panell) els escriu `subur sync`, que corre a `predev`, `prebuild` i `preseed` (aquí, després de `scripts/assert-demo-db.mjs`).

L'e2e (`pnpm test:e2e`) necessita `PREVIEW_SECRET`, `SUBUR_ADMIN_EMAIL` i `SUBUR_ADMIN_PASSWORD` al `.env`: `cp .env.example .env` hi posa els valors només locals.

El paquet hi arriba **injectat** (`dependenciesMeta` al `package.json`): una còpia que resol el motor (dependències exactes del nucli) amb les mateixes variants de peers que la demo, que el declara a les mateixes versions exactes: `next` i els `@payloadcms/*` es resolen en un sol context, sense les dues còpies del motor del panell (el bug de contextos duplicats). Just després d'instal·lar només té els `files` publicats; després de cada build del paquet corregut per pnpm (`pnpm -C ../.. build`, `syncInjectedDepsAfterScripts` a `pnpm-workspace.yaml`) hi reflecteix tot el directori del paquet llevat de `node_modules`. Un `tsx scripts/build.ts` sense pnpm no la sincronitza. La fidelitat als `files` la prova l'acceptació amb el tarball.

Els fitxers de `src/app/**`, `src/proxy.ts` i `src/site/seed/run.ts` són generats: rutes primes sobre les fàbriques del paquet que escriu `subur sync` (a `predev`, `prebuild` i `preseed`), com a qualsevol client. No es versionen (són al `.gitignore`) ni s'editen: el `sync` següent desfà qualsevol canvi.
