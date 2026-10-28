// Guarda de la base de la demo (abans del seed i de les fotos del hero): mai la base de desenvolupament de l'arrel ni cap altra que no sigui de la demo, de proves o de la porta.
import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

const fromFile = existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')).DATABASE_URL : undefined
const url = process.env.DATABASE_URL ?? fromFile
if (!url) { console.error('demo: falta DATABASE_URL'); process.exit(1) }
// Mai la URL a la sortida: `new URL` la cita sencera (contrasenya inclosa) quan no és vàlida.
let name
try {
  name = decodeURIComponent(new URL(url).pathname.slice(1))
} catch {
  console.error('demo: DATABASE_URL no és una URL vàlida')
  process.exit(1)
}
const ok = /^subur_(demo|test|gate)/.test(name) || (process.env.CI === 'true' && name === 'subur')
if (!ok) { console.error(`demo: base «${name}» no permesa (subur_demo*, subur_test*, subur_gate*; o subur amb CI=true)`); process.exit(1) }
if (process.env.DATABASE_URL && fromFile && process.env.DATABASE_URL !== fromFile) console.error(`demo: atenció, DATABASE_URL de l'entorn (${name}) mana sobre el .env`)
