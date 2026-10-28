// core/packages/create-subur-app/src/bootstrap.ts — el mínim per instal·lar el nucli abans de tenir les seves plantilles (R2).
// Els dos fitxers són, byte a byte, templates/client/_npmrc i pnpm-workspace.yaml del nucli (tests/int/parity.int.spec.ts).
export const NPMRC = `strict-peer-dependencies=false
enable-pre-post-scripts=true
# El motor, Next, React, Tailwind, eslint-config-next i graphql són dependències exactes de @suburlabs/core: el client no
# els declara i aquests patrons els fan resolubles des de l'arrel (bins inclosos). \`subur check\` ho comprova.
public-hoist-pattern[]=next
public-hoist-pattern[]=react
public-hoist-pattern[]=react-dom
public-hoist-pattern[]=payload
public-hoist-pattern[]=@payloadcms/*
public-hoist-pattern[]=tailwindcss
public-hoist-pattern[]=@tailwindcss/*
public-hoist-pattern[]=eslint-config-next
public-hoist-pattern[]=graphql
`
export const WORKSPACE_YAML = `allowBuilds:
  esbuild: true
  sharp: true
  unrs-resolver: true
`
export const bootstrapPackageJson = (slug: string, coreSpec: string) => `${JSON.stringify({ name: `subur-${slug}`, private: true, type: 'module', packageManager: 'pnpm@10.33.0', engines: { node: '>=24' }, dependencies: { '@suburlabs/core': coreSpec } }, null, 2)}\n`
