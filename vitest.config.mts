import { defineConfig } from 'vitest/config'

// Les proves del workspace que no són de cap paquet (els paquets i la demo porten la seva configuració). Sense aquest
// fitxer, vitest puja a buscar la configuració del directori de sobre: dins del repo que conté core/, la de l'arrel, amb
// la seva base de dades i les seves proves.
export default defineConfig({ test: { include: ['scripts/**/*.test.ts'] } })
