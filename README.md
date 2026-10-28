# Nucli de Subur

Aquest repositori conté els dos paquets que es publiquen a npm i la web d'exemple que els fa servir:

- `packages/core` — `@suburlabs/core`, el nucli reutilitzable de les webs de Subur (col·leccions, blocs, camps, hooks,
  migracions, la CLI `subur` amb `sync`, `check`, `update`, `migrate` i `gate`, les plantilles del client i les fonts de la
  imatge de còpies de seguretat a `packages/core/backup/`).
- `packages/create-subur-app` — la CLI que crea el repositori d'un client nou (`npx create-subur-app`); vegeu el seu README.
- `examples/demo` — una web d'exemple amb la forma d'un client, membre del workspace (privada: no es publica).

El nucli es publica amb llicència MIT; vegeu `LICENSE`.

## Treballar-hi

Cal Node 24 i `pnpm` 10. Des d'aquesta carpeta:

| Ordre | |
|---|---|
| `pnpm install` | Instal·la el workspace. |
| `pnpm build` | Construeix els dos paquets (la demo i les proves els importen des de `dist/`). |
| `pnpm typecheck` | `tsc` de cada paquet, de la demo i dels scripts del workspace. |
| `pnpm lint` | ESLint de tot el workspace. |
| `pnpm test:int` | Les proves del nucli, de la CLI i de la demo (cal una base de dades: `DATABASE_URL`). |
| `pnpm guards` | La guarda «cap dada de client» sobre el workspace i el contingut d'`npm pack` (cal `pnpm build`). |
| `pnpm guards:test`, `pnpm test:scripts` | Les proves de les guardes i dels scripts del CI. |
| `pnpm acceptance` | Crea una app amb la CLI des del seu *tarball* fora del repositori, en construeix la imatge real i hi passa la porta (cal Docker). |
| `pnpm knip` | Codi i dependències morts. |

El CI és `.github/workflows/check.yml` (`check`, `e2e` de la demo en producció i `acceptance`).

## Publicar

Les versions les porta [changesets](https://github.com/changesets/changesets). Els dos paquets van fixats a la mateixa
versió (`.changeset/config.json`, `fixed`).

1. Cada PR que canvia un paquet hi afegeix un changeset: `pnpm changeset` (paquets, salt i una línia per al
   `CHANGELOG.md`).
2. En fusionar a `main`, `release.yml` obre o actualitza la PR «chore: version packages» amb els changesets pendents.
3. En fusionar aquella PR, `release.yml` construeix i publica `@suburlabs/core` i `create-subur-app` a npmjs (*trusted
   publishing* per OIDC, sense token, amb procedència) i etiqueta `v<x.y.z>` sobre el commit. L'etiqueta és la que els
   clients fixen al `uses:` del seu `image.yml`.

El salt trencador: un canvi a la interfície del client — les plantilles de `packages/core/templates/client/`
(llevat dels `.env*.example`), la llista de fitxers de `templates/generated/`, `src/templates/files.ts`, els tokens CSS
que el nucli consumeix o un subcamí d'`exports` retirat — és `minor` mentre la versió és 0.x i `major` des de la 1.0.
`pnpm guards:templates` ho comprova al CI contra l'última etiqueta `v*` (les `backup-v*` no compten): sense el changeset
del salt que toca, o una versió que ja el porti, el CI falla.

## El workflow dels clients

`.github/workflows/client-image.yml` és el CI de tot client (`workflow_call`). La plantilla `image.yml` del client el crida
amb `uses: suburlabs/subur-core/.github/workflows/client-image.yml@v<versió del nucli instal·lada>` i li passa `site_url`
i, opcionalment, les dues variables d'Umami. Fa `subur sync` i `subur check`, `typecheck`, `lint` i les proves del client
si en té; després construeix la imatge `web` i la del seed (`-seed`), corre les migracions i el seed des del checkout i hi
passa la porta de la memòria cau amb la imatge real. A `main` promou `latest` per digest; en una PR no puja res. El
`concurrency` i els permisos (`contents: read`, `packages: write`) els posa la plantilla del client, que és qui crida.

## La imatge de còpies de seguretat

`.github/workflows/backup.yml` construeix `ghcr.io/suburlabs/subur-backup` des de les fonts de `packages/core/backup/`
(mai una còpia per digest d'una imatge ja construïda) amb la versió de `packages/core/backup/VERSION`, i etiqueta `backup-v<VERSION>` sobre el commit. Una versió
publicada no es reescriu: qualsevol canvi a `packages/core/backup/**` puja `VERSION`, o el workflow falla. Camí manual:
`gh workflow run backup.yml --ref main`.

## La guarda de l'historial

El repositori és públic: `pnpm guards:history` (al job `check`, amb la història sencera) revisa cada commit de totes les
branques (autor, *committer*, missatge i diff) i falla amb un clon superficial.

- Autors i *committers*: adreces `@subur.dev`, l'adreça `noreply` de GitHub (`<id>+<usuari>@users.noreply.github.com`,
  també la dels `[bot]`), l'adreça `noreply` del domini `github.com` (el *committer* de les fusions fetes a GitHub) i els
  dominis reservats (`example.com`, `.test`, `.invalid`…). Per això el commit inicial i els commits fets a mà porten
  l'adreça `noreply` de GitHub de qui els fa (`git config user.email`), mai una adreça personal.
  Les fusions i els *squash* fets a la web de GitHub prenen com a autor l'adreça triada al diàleg de fusió: ha de ser
  la `noreply`, o `main` queda amb una troballa `autor` permanent.
- Missatges: les mateixes regles que la guarda de dades de client (cap nom de client, servidor, IP, token ni correu
  personal) i cap token sencer de 32 xifres hexadecimals. La línia `Co-Authored-By:` de l'atribució del model (amb
  l'adreça `noreply` d'Anthropic) es conserva.
- Diffs: les regles de la guarda de dades de client sobre el diff sencer de cada commit, llevat dels `pnpm-lock.yaml` (hi
  ha correus de tercers als avisos `deprecated:`).

Un commit que no passa no s'arregla amb un commit nou: cal reescriure'l abans que arribi al repositori.
