# Changesets

Cada PR que canvia `@suburlabs/core` o `create-subur-app` hi afegeix un changeset amb `pnpm changeset`: els paquets, el
salt (`patch`, `minor` o `major`) i una línia per al `CHANGELOG.md`. Els dos paquets van fixats a la mateixa versió.

En 0.x, un canvi a la interfície del client (les plantilles de `packages/core/templates/client/`, la llista de fitxers
generats, els tokens que el nucli consumeix o un subcamí d'`exports` retirat) és `minor`; des de la 1.0, `major`.
`pnpm guards:templates` ho comprova contra l'última etiqueta `v*`.

`release.yml` obre la PR «chore: version packages» amb els changesets pendents; en fusionar-la, publica a npm i etiqueta
`v<x.y.z>`.
