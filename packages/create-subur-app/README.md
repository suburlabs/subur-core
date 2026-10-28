# create-subur-app

Crea el repositori d'un client de Subur sobre [`@suburlabs/core`](https://www.npmjs.com/package/@suburlabs/core). Es publica
amb llicència MIT (vegeu `LICENSE`); el codi viu a [suburlabs/subur-core](https://github.com/suburlabs/subur-core). Cal Node 24,
`pnpm` i `git` al `PATH` (i, amb `--repo`, `gh` amb una sessió activa: `gh auth login`).

## Crear

```sh
npx create-subur-app <dir> --slug <id> --domain <domini> --locale ca|es --name "<nom>"
```

Pas a pas, dins de `<dir>` (buit o inexistent):

1. `git init` (el directori és l'arrel del seu repositori).
2. Instal·la `@suburlabs/core` a la mateixa versió que la CLI (o el *tarball* de `--core-tarball`, copiat a `vendor/`).
3. Escriu les plantilles del nucli instal·lat i la bastida de la web: `src/site/` (configuració, tema, fonts i contingut de
   mostra), `public/site/`, `next.config.ts`, `README.md`, `DESIGN.md`, `PRODUCT.md` i `docs/client/`. Només la configuració
   i els tres `.md` porten el nom, el domini, l'idioma i l'identificador; la resta es copia tal qual.
4. Amb `--business <camí>`, escriu `.subur/` des de subur-business (`subur client project`).
5. `subur sync`, `subur check` i, llevat de `--no-build`, `pnpm build`.
6. El primer commit.
7. Amb `--repo suburlabs/<id> --site-url https://<domini>`: crea el repositori privat a GitHub, hi posa les variables
   `SITE_URL` (i, amb `--umami-website-id` i `--umami-script-url`, les d'Umami) abans del primer push, i hi fa el push.

Al final llista el que queda a mà:

- `.subur/`, si no s'ha passat `--business`: des de subur-business, `subur client project <id> --repo <dir>`.
- El repositori de GitHub, si no s'ha passat `--repo`: `gh repo create suburlabs/<id> --private` i la variable `SITE_URL`
  (`gh variable set`) abans del primer push.
- Les variables `UMAMI_WEBSITE_ID` i `UMAMI_SCRIPT_URL` del repositori, si no s'han passat (totes dues o cap).
- L'alta a la plataforma (`ops alta --repo <dir>`, des de subur-ops).
- La plantilla del client a subur-business: `subur client set <id> --template subur-core@<versió>`.

El CI del client és el seu `.github/workflows/image.yml`, que crida el workflow reutilitzable `client-image.yml` del nucli
fixat a la mateixa versió que `@suburlabs/core`: Renovate els mou junts i `subur check` exigeix que coincideixin.

Opcions:

| Opció | |
|---|---|
| `--slug <id>` | L'identificador del client: minúscules, xifres i `_`. |
| `--domain <domini>` | Sense `https://` ni barres. |
| `--locale ca\|es` | L'idioma del client (i el per defecte de la web). |
| `--name "<nom>"` | El nom de la web; sense cometes dobles ni barres invertides. |
| `--repo <propietari/nom>` | El repositori de GitHub; necessita `--site-url`. |
| `--site-url <https://…>` | La URL pública, sense barra final. |
| `--umami-website-id`, `--umami-script-url` | Totes dues o cap. |
| `--business <camí>` | El directori de subur-business, per escriure `.subur/`. |
| `--core-tarball <fitxer>` | Un `suburlabs-core-x.y.z.tgz` en lloc de la versió del registre. |
| `--no-build` | Sense el `pnpm build` final. |

## Actualitzar

```sh
npx create-subur-app update [<dir>]
```

Corre `subur update` del nucli instal·lat al client (per defecte, el directori actual): torna a escriure les plantilles
del nucli amb la versió instal·lada i en mostra el `diff`, per revisar-lo abans del commit.
