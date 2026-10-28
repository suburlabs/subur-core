# @suburlabs/core

El nucli de les webs de Subur: les col·leccions, els blocs, els camps, els hooks, les migracions i la interfície compartida que cada web de client importa per subcamins (`@suburlabs/core/site`, `@suburlabs/core/ui`, `@suburlabs/core/contract`, …). Es publica amb llicència MIT (vegeu `LICENSE`); el codi viu a [suburlabs/subur-core](https://github.com/suburlabs/subur-core). Els consumidors compilen amb `"moduleResolution": "bundler"` (com la plantilla) o amb `skipLibCheck`: les declaracions de `dist` importen `next/cache`, `next/headers` i `next/server`, que `next` no exposa amb un mapa `exports` i que, sota `NodeNext` sense `skipLibCheck`, no es resolen.

## Dependències

El nucli porta el motor (`payload` i els `@payloadcms/*`), Next, React, Tailwind (`tailwindcss` i `@tailwindcss/postcss`), `eslint-config-next` i `graphql` com a **dependències exactes**: una versió del nucli fixa tota la pila. Un client **no els declara** al seu `package.json`; el `.npmrc` de la plantilla els hissa a l'arrel de `node_modules` (bins inclosos), de manera que `next`, el `postcss.config` i l'`eslint.config` del client els resolen sense declarar-los. `subur check` vigila que cap client no els torni a declarar. La demo del *workspace* (`examples/demo`, amb el paquet injectat) sí que els declara, a les mateixes versions exactes que el nucli, perquè resolgui el motor al seu propi context i la còpia injectada en vegi la mateixa variant; `tests/int/engineDeps.int.spec.ts` ho comprova.

## Un client

```sh
npx create-subur-app <dir> --slug <id> --domain <domini> --locale ca|es --name "<nom>"
```

La CLI crea el repositori d'un client amb la versió del nucli que porta, l'instal·la, en comprova el build i en fa el primer commit. El repositori té tres menes de fitxers:

- **Del client** (versionats; els edita qui fa la web): `src/site/` (`site.config.ts`, que només importa `@suburlabs/core/site`; `theme.css`; `fonts.ts`; el contingut i els mitjans del seed), `next.config.ts` (`export default withSubur({ … })`), `public/site/`, `vendor/`, els `.env*.example` i el `package.json` (els scripts `dev` i `start` són seus; la resta, del contracte). Tot `src/site/` importa només l'API del client: `@suburlabs/core/site`, `@suburlabs/core/seed`, `@suburlabs/core/types` i `@suburlabs/core/ui` (i `fonts.ts`, `next/font/google`).
- **Plantilles exactes** (versionades, però del nucli): `Dockerfile`, `.dockerignore`, `docker-compose.dev.yml`, `eslint.config.mjs`, `next-sitemap.config.cjs`, `postcss.config.js`, `src/payload.config.ts`, `src/subur-env.d.ts` i `tsconfig.json`; i, a l'arrel del repositori, `.github/workflows/image.yml`, `.npmrc`, `pnpm-workspace.yaml` i `renovate.json`. No s'editen a mà: `subur check` les compara byte a byte amb les de la versió instal·lada.
- **Generats** (propietat del nucli, ni versionats ni editats): els escriu `subur sync`.

## `subur sync`

Corre a `predev`, a `prebuild` (i, per tant, al build de la imatge) i a `preseed`. Escriu una llista tancada de fitxers propietat del nucli tal com són a `templates/generated/` del paquet: els fitxers de ruta de `src/app/` (el web públic, el panell i l'API), `src/app/(frontend)/globals.css`, `src/proxy.ts` i `src/site/seed/run.ts`; després, el motor hi genera el mapa d'imports del panell, `src/app/(subur)/admin/importMap.js`. Només reescriu el que ha canviat, i de manera atòmica; no necessita base de dades ni secrets. Aquests fitxers són al `.gitignore` i al `.dockerignore` de la plantilla (amb els claudàtors escapats) i **no s'editen**: el `sync` següent desfà qualsevol canvi. Un client pot afegir rutes pròpies fora de la llista.

## `subur check`

Comprova que el client del directori actual té la forma que el nucli espera, i surt amb codi 1 i un problema per línia si no la té (`check: ok (N comprovacions)` si la té). Corre al CI del client, després de `subur sync`. Les 11 comprovacions:

1. El client és un repositori git (sense repositori no se n'avalua cap altra).
2. Les plantilles exactes de l'app són, byte a byte, les de la versió instal·lada.
3. Les plantilles exactes del repositori (`.github/workflows/image.yml`, `.npmrc`, `pnpm-workspace.yaml`, `renovate.json`), també.
4. El `.gitignore` porta cada línia obligatòria (en pot portar més).
5. Cada fitxer generat i el mapa d'imports hi són, no estan versionats i git els ignora.
6. El `package.json`: `@suburlabs/core` a la versió exacta instal·lada (o el seu *tarball* de `vendor/`), cap paquet del motor declarat (ni a `dependencies`, `devDependencies`, `optionalDependencies` o `peerDependencies`, ni re-fixat amb `overrides`, `resolutions`, `pnpm.overrides` o `pnpm.packageExtensions`), cap `.pnpmfile.cjs` ni `.pnpmfile.mjs` a l'arrel (en un membre, tampoc en cap directori fins a l'arrel del repositori), i `packageManager`, `type`, `engines.node` i els scripts del contracte com a la plantilla.
7. `theme.css` defineix al `:root` clar cada token que el CSS del nucli consumeix, i no redefineix cap propietat que el nucli ja defineix a `:root` o a `.dark`.
8. `themeColor` de `site.config.ts` té exactament `light` i `dark`, iguals al `--background` de `:root` i de `.dark` de `theme.css`.
9. `src/site/` (llevat dels generats) importa només l'API del client; `site.config.ts`, només `@suburlabs/core/site`. Els enllaços simbòlics sota `src/site/` no s'escanegen (no se segueixen ni es llegeixen).
10. `next.config.ts` importa `withSubur` de `@suburlabs/core/next` i l'exporta per defecte.
11. Hi ha un directori `vendor/` (el `Dockerfile` el copia; n'hi ha prou amb un `README.md`).

En un membre d'un *workspace* (com `examples/demo`, que no és l'arrel del seu repositori) la (3) s'omet i ho diu (`check: membre d'un workspace: 4 fitxers de repositori no comprovats …`), i la (6) hi admet `workspace:*` per al nucli i els paquets del motor (només a `dependencies` i `devDependencies`) a la versió exacta que en porta el nucli, i que `preseed` porti una sola ordre simple davant del de la plantilla (`<ordre> && subur sync`; la demo hi verifica la base abans del seed): hi corren 10 comprovacions.

## Actualitzar el nucli

- **Sense canvi d'interfície** (*patch*, i *minor* que no la toca): la PR de Renovate, sola. Mou alhora `@suburlabs/core` i el `uses:` d'`image.yml` a la mateixa versió; el CI del client la valida amb `subur check` i la porta.
- **Amb canvi d'interfície** (un salt trencador: *minor* en `0.x`, *major* a partir de l'1.0): `pnpm install && pnpm exec subur update`, que torna a escriure les plantilles de la versió nova, i revisar-ne el `diff` abans de fer-ne commit. `subur check` ho demana amb aquesta mateixa ordre quan una plantilla exacta no és la de la versió instal·lada.
