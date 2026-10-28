# {{name}}

La web de {{name}} ({{domain}}), feta amb Subur sobre `@suburlabs/core`. Aquest repositori conté només el que és propi
d'aquesta web; la resta (el panell, les rutes, els blocs, la base de dades) ve del nucli.

## Posar-la en marxa

```sh
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d
pnpm install
pnpm exec subur migrate
pnpm seed
pnpm dev
```

## Què és de la web i què és del nucli

De la web (s'editen aquí i es versionen):

- `src/site/`: la configuració (`site.config.ts`), el tema (`theme.css`), les fonts i el contingut de mostra (`seed/`).
- `public/site/`: el logo, el film de la portada i les imatges.
- `DESIGN.md` i `PRODUCT.md`: el disseny i el producte d'aquesta web.
- `docs/client/`: guies, textos i decisions.
- `next.config.ts` i `src/app/(subur)/custom.scss`.

Del nucli:

- Els fitxers que el `.gitignore` llista sota «Propietat del nucli»: es tornen a generar a cada `pnpm dev` i `pnpm build`
  (`subur sync`) i no es versionen.
- La resta de fitxers de configuració (`Dockerfile`, `tsconfig.json`, `.npmrc`, `eslint.config.mjs`…) són plantilles
  del nucli: no s'editen a mà.

`AGENTS.md` i `CLAUDE.md` els escriu `next dev` i es versionen.

## Comprovar

`pnpm check` comprova que el repositori segueix el contracte amb el nucli (plantilles, generats, dependències, tema).

## Actualitzar

Renovate obre les actualitzacions de `@suburlabs/core`. En un salt de versió trencador:

```sh
pnpm install && pnpm exec subur update
```

`subur update` reescriu les plantilles del nucli amb la versió instal·lada; revisa el diff abans del commit.
