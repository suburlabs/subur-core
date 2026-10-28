// jsdom no té window.matchMedia, i ScrollTrigger (Film.client.tsx, que RenderBlocks i el barril ./app carreguen) el crida en registrar-se.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({ addEventListener() {}, addListener() {}, dispatchEvent: () => false, matches: false, media: query, onchange: null, removeEventListener() {}, removeListener() {} }) as unknown as MediaQueryList
}

// Els tests d'integració escriuen a la base: només ho poden fer sobre la base
// efímera que crea tests/globalSetup.ts. Sense aquesta guarda, un test
// contra la base de desenvolupament n'esborra usuaris i pàgines (pla F).
if (!process.env.DATABASE_URL?.includes('subur_test_')) {
  throw new Error(
    `vitest: DATABASE_URL ha d'apuntar a una base subur_test_*; ara apunta a ${process.env.DATABASE_URL?.replace(/:[^:@/]+@/, ':***@')}`,
  )
}
