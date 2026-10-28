// core/packages/create-subur-app/tests/int/args.int.spec.ts — les opcions de `create-subur-app` i els errors d'ús del binari
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

import { CliError, parseCreate, USAGE } from '../../src/args.js'
import { recoveryHint } from '../../src/create.js'

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const scratch = mkdtempSync(path.join(os.tmpdir(), 'create-subur-app-args-'))
afterAll(() => rmSync(scratch, { force: true, recursive: true }))

const BASE = ['app', '--slug', 'prova', '--domain', 'prova.example', '--locale', 'ca', '--name', 'Reformes Prova']
/** BASE amb `--opció valor` canviat (o afegit); `null` la treu. */
const withOpt = (key: string, value: string | null, args = BASE) => {
  const i = args.indexOf(key)
  const out = [...args]
  if (i >= 0) out.splice(i, 2, ...(value === null ? [] : [key, value]))
  else if (value !== null) out.push(key, value)
  return out
}
const fails = (args: string[], message: RegExp) => {
  let error: unknown
  try {
    parseCreate(args, '1.2.3')
  } catch (e) {
    error = e
  }
  expect(error, args.join(' ')).toBeInstanceOf(CliError)
  expect((error as CliError).exitCode).toBe(2)
  expect((error as CliError).message).toMatch(message)
}
const bin = (args: string[], env: NodeJS.ProcessEnv = process.env) => spawnSync(process.execPath, [path.join(CLI, 'bin/create-subur-app.js'), ...args], { cwd: scratch, encoding: 'utf8', env })
/** Un executable de mentida a `dir`. */
const fake = (dir: string, name: string, script: string) => { mkdirSync(dir, { recursive: true }); writeFileSync(path.join(dir, name), `#!/bin/sh\n${script}\n`); chmodSync(path.join(dir, name), 0o755) }

describe('parseCreate', () => {
  it('les opcions mínimes: el directori absolut, la versió de la CLI, el slug i cap opcional', () => {
    const o = parseCreate(BASE, '1.2.3')
    expect(o).toEqual({
      business: undefined, coreTarball: undefined, coreVersion: '1.2.3', dir: path.resolve('app'), domain: 'prova.example', locale: 'ca', name: 'Reformes Prova', noBuild: false,
      repo: undefined, siteUrl: undefined, slug: 'prova', umamiScriptUrl: undefined, umamiWebsiteId: undefined,
    })
  })

  it('totes les opcions', () => {
    const o = parseCreate([...withOpt('--locale', 'es'), '--repo', 'suburlabs/prova', '--site-url', 'https://prova.example', '--umami-website-id', 'w1', '--umami-script-url', 'https://a.example/s.js', '--business', scratch, '--no-build'], '1.2.3')
    expect(o).toMatchObject({ business: scratch, locale: 'es', noBuild: true, repo: 'suburlabs/prova', siteUrl: 'https://prova.example', umamiScriptUrl: 'https://a.example/s.js', umamiWebsiteId: 'w1' })
  })

  it('el directori: un i només un', () => {
    fails(BASE.slice(1), /^ús:/)
    fails([...BASE, 'un-altre'], /^ús:/)
  })

  it('cada opció obligatòria', () => {
    for (const key of ['--slug', '--domain', '--locale', '--name']) fails(withOpt(key, null), new RegExp(`^falta ${key}\\n`))
  })

  it('--slug: minúscules, xifres i _', () => {
    for (const slug of ['Prova', 'pro-va', 'pro va', 'prova.']) fails(withOpt('--slug', slug), /^--slug «/)
    expect(parseCreate(withOpt('--slug', 'prova_2'), '1.2.3').slug).toBe('prova_2')
  })

  it('--domain: sense esquema ni barres, amb almenys un punt', () => {
    for (const domain of ['https://prova.example', 'prova.example/', 'prova', 'Prova.example', 'prova-.example']) fails(withOpt('--domain', domain), /^--domain «/)
    expect(parseCreate(withOpt('--domain', 'www.prova-1.example'), '1.2.3').domain).toBe('www.prova-1.example')
  })

  it('--locale: ca o es', () => {
    fails(withOpt('--locale', 'en'), /^--locale ha de ser ca o es$/)
  })

  it('--name: sense cometes dobles ni barres invertides (va entre cometes dobles a site.config.ts)', () => {
    fails(withOpt('--name', 'Reformes "Prova"'), /^--name no pot dur/)
    fails(withOpt('--name', 'Reformes\\Prova'), /^--name no pot dur/)
    for (const c of ['\n', '\r', '\t', '\x00', '\x1b', '\x7f']) fails(withOpt('--name', `Reformes${c}Prova`), /^--name no pot dur cometes dobles, barres invertides ni caràcters de control$/)
    expect(parseCreate(withOpt('--name', "Reformes d'en Pere"), '1.2.3').name).toBe("Reformes d'en Pere")
  })

  it('--repo: propietari/nom, i sempre amb --site-url', () => {
    fails([...BASE, '--repo', 'prova', '--site-url', 'https://prova.example'], /^--repo «prova»/)
    fails([...BASE, '--repo', 'suburlabs/prova'], /^--repo necessita --site-url/)
  })

  it('--site-url: https://<domini>, sense barra final', () => {
    for (const url of ['http://prova.example', 'https://prova.example/', 'prova.example']) fails([...BASE, '--site-url', url], /^--site-url ha de ser/)
  })

  it('--business: ha d\'existir', () => {
    fails([...BASE, '--business', path.join(scratch, 'no-hi-es')], /^--business no existeix: /)
    expect(parseCreate([...BASE, '--business', scratch], '1.2.3').business).toBe(scratch)
  })

  it('Umami: totes dues o cap', () => {
    fails([...BASE, '--umami-website-id', 'w1'], /^--umami-website-id i --umami-script-url, tots dos o cap$/)
    fails([...BASE, '--umami-script-url', 'https://a.example/s.js'], /^--umami-website-id i --umami-script-url, tots dos o cap$/)
  })

  it('--core-tarball: el nom fixa la versió del nucli; ha d\'existir', () => {
    const tgz = path.join(scratch, 'suburlabs-core-0.4.1.tgz')
    writeFileSync(tgz, '')
    const o = parseCreate([...BASE, '--core-tarball', tgz], '1.2.3')
    expect(o.coreVersion).toBe('0.4.1')
    expect(o.coreTarball).toBe(tgz)
    fails([...BASE, '--core-tarball', path.join(scratch, 'suburlabs-core-0.4.2.tgz')], /^--core-tarball no existeix: /)
    const other = path.join(scratch, 'core.tgz')
    writeFileSync(other, '')
    fails([...BASE, '--core-tarball', other], /^--core-tarball ha de ser un suburlabs-core-x\.y\.z\.tgz: core\.tgz$/)
  })
})

describe('el binari: errors d\'ús amb codi 2 i la línia d\'ús, mai una traça', () => {
  it('una opció desconeguda (--bogus)', () => {
    const r = bin([...BASE, '--bogus'])
    expect(r.status).toBe(2)
    expect(r.stderr).toContain(USAGE)
    expect(r.stderr).not.toMatch(/^\s+at /m)
  })

  it('--slug sense valor', () => {
    const r = bin(['app', '--slug'])
    expect(r.status).toBe(2)
    expect(r.stderr).toContain(USAGE)
    expect(r.stderr).not.toMatch(/^\s+at /m)
  })

  it('una validació de parseCreate (--locale en)', () => {
    const r = bin(withOpt('--locale', 'en'))
    expect(r.status).toBe(2)
    expect(r.stderr.trim()).toBe('--locale ha de ser ca o es')
  })

  it('sense arguments: la línia d\'ús i codi 2; --help: la línia d\'ús i codi 0', () => {
    const none = bin([])
    expect(none.status).toBe(2)
    expect(none.stderr).toContain(USAGE)
    const help = bin(['--help'])
    expect(help.status).toBe(0)
    expect(help.stdout).toContain(USAGE)
  })

  it('update en un directori sense el nucli instal·lat: codi 2', () => {
    const r = bin(['update', path.join(scratch, 'buit')])
    expect(r.status).toBe(2)
    expect(r.stderr).toMatch(/no hi ha @suburlabs\/core instal·lat/)
  })
})

describe('la pista de recuperació, segons l\'etapa', () => {
  it('a mitges en local: esborrar i tornar-hi', () => {
    expect(recoveryHint('local', '/tmp/app')).toBe('pista: /tmp/app ha quedat a mitges; esborra /tmp/app i torna-ho a provar')
  })

  it('amb el repositori de GitHub ja creat: no tornar-lo a crear, variables i push', () => {
    const hint = recoveryHint('remote', '/tmp/app', 'suburlabs/prova')
    expect(hint).toMatch(/el repositori suburlabs\/prova ja existeix a GitHub/)
    expect(hint).toMatch(/gh variable set … -R suburlabs\/prova/)
    expect(hint).toMatch(/git -C \/tmp\/app push -u origin main$/)
    expect(hint).not.toMatch(/esborra/)
  })
})

describe('el binari: fallades amb el directori a mitges, preflight de gh i update', () => {
  it('una fallada després d\'escriure (un tarball que no ho és): codi 1, el motiu i la pista local', () => {
    const tgz = path.join(scratch, 'trencat', 'suburlabs-core-9.9.9.tgz')
    mkdirSync(path.dirname(tgz), { recursive: true })
    writeFileSync(tgz, 'no és un tarball')
    const dir = path.join(scratch, 'a-mitges')
    const r = bin([dir, ...BASE.slice(1), '--core-tarball', tgz, '--no-build'])
    expect(r.status, r.stderr).toBe(1)
    expect(r.stderr).toContain(`pista: ${dir} ha quedat a mitges; esborra ${dir} i torna-ho a provar`)
    expect(r.stderr).not.toMatch(/^\s+at /m)
    expect(existsSync(path.join(dir, '.git'))).toBe(true)
  })

  it('--repo sense sessió de gh: codi 1, el motiu, i no s\'ha escrit res', () => {
    const fakeBin = path.join(scratch, 'gh-sense-sessio')
    fake(fakeBin, 'gh', '[ "$1" = "--version" ] && exit 0\nexit 1')
    const dir = path.join(scratch, 'sense-sessio')
    const r = bin([dir, ...BASE.slice(1), '--repo', 'suburlabs/prova', '--site-url', 'https://prova.example'], { ...process.env, PATH: `${fakeBin}:${process.env.PATH}` })
    expect(r.status, r.stderr).toBe(1)
    expect(r.stderr).toMatch(/^gh no té cap sessió activa \(gh auth login\)/m)
    expect(r.stderr).not.toMatch(/pista:/)
    expect(existsSync(dir)).toBe(false)
  })

  it('update --help: la línia d\'ús i codi 0 (no és cap directori)', () => {
    const r = bin(['update', '--help'])
    expect(r.status).toBe(0)
    expect(r.stdout).toContain(USAGE)
  })

  it('update: un error d\'ús de subur update (2) continua sent 2; qualsevol altra fallada, 1', () => {
    for (const [code, expected] of [[2, 2], [3, 1]] as const) {
      const dir = path.join(scratch, `client-${code}`)
      mkdirSync(path.join(dir, 'node_modules/@suburlabs/core/bin'), { recursive: true })
      writeFileSync(path.join(dir, 'package.json'), '{ "name": "client", "private": true }\n')
      writeFileSync(path.join(dir, 'node_modules/@suburlabs/core/bin/subur.js'), '')
      fake(path.join(dir, 'node_modules/.bin'), 'subur', `echo "subur $*" >&2\nexit ${code}`)
      const r = bin(['update', dir])
      expect(r.status, `${code}: ${r.stderr}`).toBe(expected)
      expect(r.stderr).toMatch(/subur update/)
      expect(r.stderr).not.toMatch(/^\s+at /m)
    }
  })
})
