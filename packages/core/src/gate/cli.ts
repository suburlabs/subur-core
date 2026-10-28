import path from 'node:path'
import { parseArgs } from 'node:util'

import { loadFacts } from '../bin/loadClient.js'
import { cacheGate, GateFailed, GateFailure, type GateOptions, report } from './cacheGate.js'

/** Les opcions d'avui de la porta; el repositori i els fets els posa `main`. */
function readOptions(argv: string[]): Omit<GateOptions, 'facts' | 'repo'> {
  const { values } = parseArgs({
    args: argv,
    options: {
      'base-url': { default: 'http://127.0.0.1:3000', type: 'string' },
      'db-url': { type: 'string' },
      'docker-net': { default: 'host', type: 'string' },
      image: { type: 'string' },
      'media-dir': { type: 'string' },
    },
  })
  const image = values.image
  const mediaDir = values['media-dir']
  const dbUrl = values['db-url'] ?? process.env.DATABASE_URL
  const net = values['docker-net']
  if (!image) throw new GateFailure('opcions', 'falta --image', '--image <ref>', 'res')
  if (!mediaDir)
    throw new GateFailure(
      'opcions',
      'falta --media-dir',
      '--media-dir <dir> (el de MEDIA_DIR del seed)',
      'res',
    )
  if (!dbUrl) throw new GateFailure('opcions', 'falta la base', '--db-url o DATABASE_URL', 'res')
  if (net !== 'host' && net !== 'bridge')
    throw new GateFailure('opcions', '--docker-net no vàlida', 'host o bridge', String(net))
  // Amb `--network host` la web escolta al 3000 de la imatge: cap altre port no respondria.
  const basePort = new URL(values['base-url']).port || '80'
  if (net === 'host' && basePort !== '3000')
    throw new GateFailure('opcions', '--base-url amb --docker-net host', 'port 3000', basePort)
  return {
    baseUrl: values['base-url'].replace(/\/$/, ''),
    dbUrl,
    image,
    mediaDir: path.resolve(mediaDir),
    net,
  }
}

/**
 * `subur gate …` des del repositori del client: les opcions de la línia d'ordres, els fets del cwd (els mateixos
 * que `subur facts`) i la porta. Qualsevol fallada surt imprimida al format de la porta i es rebutja amb `GateFailed`.
 */
export async function main(argv: string[]): Promise<void> {
  const repo = process.cwd()
  try {
    const options = readOptions(argv)
    const facts = await loadFacts(repo, (message) => console.error(`subur gate: ${message}`))
    await cacheGate({ ...options, facts, repo })
  } catch (error) {
    if (error instanceof GateFailed) throw error
    report(error)
    throw new GateFailed()
  }
}
