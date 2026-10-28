#!/usr/bin/env node
const target = new URL('../dist/cli.js', import.meta.url)
try {
  await import(target.href)
} catch (error) {
  // Només si el que falta és dist/ mateix: un paquet absent dins de dist també dona ERR_MODULE_NOT_FOUND, sense url.
  if (error?.code !== 'ERR_MODULE_NOT_FOUND' || error.url !== target.href) throw error
  console.error('create-subur-app: falta dist/; construeix el paquet (pnpm build)')
  process.exit(1)
}
