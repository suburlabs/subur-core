// core/packages/create-subur-app/tests/int/create.int.spec.ts — creacions reals des del tarball del nucli (spec §1 criteri 1, §4.1)
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const CORE = path.resolve(CLI, '../core')
const scratch = mkdtempSync(path.join(os.tmpdir(), 'create-subur-app-'))
const bin = path.join(scratch, 'bin')
const business = path.join(scratch, 'business')
// El «github.com» local: tota URL https://github.com/<propietari>/<nom> hi va a parar (insteadOf per prefix), sigui quin sigui el nom
const github = path.join(scratch, 'github')
const remote = path.join(github, 'suburlabs/prova.git')
const calls = path.join(scratch, 'calls.log')
let tgz = ''
// Git aïllat: cap configuració de la màquina; la identitat del CI per l'entorn (GIT_CONFIG_*: guanya a la del repositori, i
// amb --repo la `noreply` de gh l'ha de vèncer igualment); cap pregunta de credencials; el remot de github.com va al bare local.
const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(AUTHOR|COMMITTER)_/.test(k))), CI: 'true', GIT_CONFIG_GLOBAL: path.join(scratch, 'gitconfig-empty'), GIT_CONFIG_NOSYSTEM: '1', GIT_TERMINAL_PROMPT: '0',
  GIT_CONFIG_COUNT: '3', GIT_CONFIG_KEY_0: `url.${github}/.insteadOf`, GIT_CONFIG_VALUE_0: 'https://github.com/',
  GIT_CONFIG_KEY_1: 'user.name', GIT_CONFIG_VALUE_1: 'create-subur-app', GIT_CONFIG_KEY_2: 'user.email', GIT_CONFIG_VALUE_2: 'ci@subur.dev',
  npm_config_prefer_offline: 'true', // la memòria cau de pnpm primer: ≈3 min en calent, fins a 15 en fred (Step 9)
  PATH: `${bin}:${process.env.PATH}`,
}
const cli = (args: string[], extra: NodeJS.ProcessEnv = {}) => spawnSync(process.execPath, [path.join(CLI, 'bin/create-subur-app.js'), ...args], { cwd: scratch, encoding: 'utf8', env: { ...env, ...extra } })
const git = (cwd: string, args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8', env }).trim()
// L'adreça `noreply` de l'usuari 1 (prova) del `gh` de mentida (la guarda de dades la deixa passar: clientData.ts, GITHUB_NOREPLY).
const NOREPLY = '1+prova@users.noreply.github.com'
const BASE = ['--slug', 'prova', '--domain', 'prova.example', '--locale', 'es', '--name', 'Reformes Prova', '--business', business, '--no-build']

beforeAll(() => {
  writeFileSync(path.join(scratch, 'gitconfig-empty'), '')
  execFileSync('pnpm', ['-C', path.join(CORE, '../..'), 'build'], { stdio: 'inherit' })
  execFileSync('pnpm', ['-C', CORE, 'pack', '--pack-destination', scratch], { stdio: 'inherit' })
  tgz = path.join(scratch, readdirSync(scratch).find((f) => /^suburlabs-core-.*\.tgz$/.test(f))!)
  // `gh` de mentida: respon a `--version`, `auth status` i `api user --jq …` (les comprovacions prèvies de create; l'usuari 1, prova, «Prova»)
  // sense registrar res, i registra cada altra crida; cap servei. El remot bare rep el push real (via insteadOf) i el seu hook registra l'ordre.
  mkdirSync(bin); writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\n[ "$1" = "--version" ] && exit 0\n[ "$1 $2" = "auth status" ] && exit 0\n[ "$1 $2 $3" = "api user --jq" ] && { echo '{"id":1,"login":"prova","name":"Prova"}'; exit 0; }\necho "gh $*" >> "${calls}"\n`, { mode: 0o755 })
  mkdirSync(remote, { recursive: true })
  execFileSync('git', ['init', '-q', '--bare', remote], { env })
  writeFileSync(path.join(remote, 'hooks/post-receive'), `#!/bin/sh\necho "push" >> "${calls}"\n`, { mode: 0o755 })
  // Un registre de mentida: `pnpm -s subur client project <slug> --repo <dir>` escriu la fixture .subur/ amb el slug real.
  mkdirSync(business)
  writeFileSync(path.join(business, 'package.json'), JSON.stringify({ name: 'business-fake', private: true, type: 'module', scripts: { subur: 'node fake.mjs' } }))
  writeFileSync(path.join(business, 'fake.mjs'), `import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
const slug = process.argv[4]; const repo = process.argv[process.argv.indexOf('--repo') + 1]; const src = ${JSON.stringify(path.join(CORE, 'tests/fixtures/subur'))}
mkdirSync(repo + '/.subur', { recursive: true })
for (const f of readdirSync(src)) writeFileSync(repo + '/.subur/' + f, readFileSync(src + '/' + f, 'utf8').replace(/"slug": "[a-z0-9_]+"/, '"slug": "' + slug + '"'))
console.log('projectat', process.argv.slice(2).join(' '))`)
})
afterAll(() => rmSync(scratch, { force: true, recursive: true }))

describe('create-subur-app', () => {
  const app = path.join(scratch, 'app')
  it('crea un client des del tarball, amb .subur/ del registre, sync i check nets, un commit amb la identitat del CI, i cap crida a gh', () => {
    const r = cli([app, ...BASE, '--core-tarball', tgz])
    expect(r.status, r.stderr).toBe(0)
    const version = /^suburlabs-core-(.+)\.tgz$/.exec(path.basename(tgz))![1]
    const pkg = JSON.parse(readFileSync(path.join(app, 'package.json'), 'utf8')) as { dependencies: Record<string, string>; name: string; scripts: Record<string, string> }
    expect(pkg.name).toBe('subur-prova')
    expect(pkg.dependencies['@suburlabs/core']).toBe(`file:./vendor/${path.basename(tgz)}`)
    expect(pkg.scripts.predev).toBe('subur sync')
    // Instantània del repositori creat (spec §11): el que es versiona, i només això
    const tracked = git(app, ['ls-files']).split('\n')
    for (const f of ['.gitignore', '.npmrc', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', 'Dockerfile', '.dockerignore', '.github/workflows/image.yml', 'renovate.json', 'src/payload.config.ts', 'src/site/site.config.ts', 'src/site/theme.css', 'src/site/seed/content/ca.ts', 'public/site/hero/film.mp4', 'next.config.ts', 'src/app/(subur)/custom.scss', 'vendor/README.md', 'vendor/' + path.basename(tgz), '.subur/contract.json', '.env.example', '.env.docker.example', '.env.backup.example', 'README.md', 'DESIGN.md', 'PRODUCT.md']) expect(tracked, f).toContain(f)
    for (const f of ['src/app/(subur)/admin/importMap.js', 'src/proxy.ts', 'src/site/seed/run.ts', 'src/app/(frontend)/[locale]/layout.tsx']) { expect(existsSync(path.join(app, f)), f).toBe(true); expect(tracked, `${f} no versionat`).not.toContain(f) }
    expect(readFileSync(path.join(app, 'src/site/site.config.ts'), 'utf8')).toContain("id: 'prova'")
    expect(readFileSync(path.join(app, 'src/site/seed/content/ca.ts'), 'utf8')).toContain('{{nom}}')
    expect(readFileSync(path.join(app, '.github/workflows/image.yml'), 'utf8')).toContain(`client-image.yml@v${version}`)
    expect(readFileSync(path.join(app, 'README.md'), 'utf8')).toContain('Reformes Prova')
    expect(readFileSync(path.join(app, '.subur/contract.json'), 'utf8')).toContain('"slug": "prova"')
    expect(readFileSync(path.join(app, '.dockerignore'), 'utf8')).toBe(readFileSync(path.join(CORE, 'templates/client/_dockerignore'), 'utf8'))   // la projecció no el canvia (ja porta .subur/)
    expect(r.stdout).toMatch(/check: ok \(11 comprovacions\)/)
    // El job `check` de client-image.yml, tal com el veurà el client: sense .next/ ni next-env.d.ts, amb eslint-config-next hissat (ronda 2, C5)
    for (const script of ['typecheck', 'lint']) { const s = spawnSync('pnpm', ['-s', script], { cwd: app, encoding: 'utf8', env }); expect(s.status, `${script}: ${s.stdout}${s.stderr}`).toBe(0) }
    expect(r.stdout).toMatch(/projectat client project prova --repo/)
    expect(r.stdout).toMatch(/Queda a mà:[\s\S]*repositori a GitHub/)
    expect(git(app, ['log', '--format=%s|%ae|%ce'])).toBe(`feat: web de Reformes Prova, creada amb create-subur-app ${version}|ci@subur.dev|ci@subur.dev`)
    expect(r.stdout).toContain('commit inicial amb create-subur-app <ci@subur.dev>\n')
    expect(git(app, ['status', '--porcelain'])).toBe('')
    expect(existsSync(calls)).toBe(false)
  })
  it('update: una plantilla editada i commitejada es restaura i es veu al diff; sense canvis, ho diu', () => {
    const dockerfile = path.join(app, 'Dockerfile')
    writeFileSync(dockerfile, `${readFileSync(dockerfile, 'utf8')}# editat\n`)
    git(app, ['-c', 'user.name=t', '-c', 'user.email=t@subur.dev', 'commit', '-qam', 'edit'])
    const r = cli(['update', app])
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toMatch(/1 fitxers reescrits[\s\S]*Dockerfile[\s\S]*1 file changed/)
    expect(readFileSync(dockerfile, 'utf8')).not.toContain('# editat')
    expect(cli(['update', app]).stdout).toMatch(/cap canvi/)
    expect(cli(['update', path.join(scratch, 'buit')]).status).toBe(2)
  })
  it('amb --repo: gh repo create, SITE_URL i Umami abans del push, i el push arriba al remot (local; mai a github.com)', () => {
    const app2 = path.join(scratch, 'app2')
    const r = cli([app2, ...BASE, '--core-tarball', tgz, '--repo', 'suburlabs/prova', '--site-url', 'https://prova.example', '--umami-website-id', 'w1', '--umami-script-url', 'https://analytics.example/script.js'], {
      // Identitats que no han de guanyar a la de gh: les variables de l'entorn de qui la crida i author.*/committer.* (que guanyen a user.*)
      GIT_AUTHOR_EMAIL: 'intrus@example.com', GIT_AUTHOR_NAME: 'Intrus', GIT_COMMITTER_EMAIL: 'intrus@example.com', GIT_COMMITTER_NAME: 'Intrus',
      GIT_CONFIG_COUNT: '5', GIT_CONFIG_KEY_3: 'author.email', GIT_CONFIG_VALUE_3: 'autor@example.com', GIT_CONFIG_KEY_4: 'committer.email', GIT_CONFIG_VALUE_4: 'committer@example.com',
    })
    expect(r.status, r.stderr).toBe(0)
    expect(readFileSync(calls, 'utf8').trim().split('\n')).toEqual([
      'gh repo create suburlabs/prova --private',
      'gh variable set SITE_URL -R suburlabs/prova -b https://prova.example',
      'gh variable set UMAMI_WEBSITE_ID -R suburlabs/prova -b w1',
      'gh variable set UMAMI_SCRIPT_URL -R suburlabs/prova -b https://analytics.example/script.js',
      'push',
    ])
    expect(git(remote, ['log', '--format=%s', 'main'])).toMatch(/^feat: web de Reformes Prova/)
    // La identitat de la sessió de gh, no la de git (ci@subur.dev de l'entorn del test) ni les intruses (variables i author.*/committer.*): GitHub rebutjaria un correu privat (GH007)
    expect(git(remote, ['log', '--format=%an|%ae|%cn|%ce', 'main'])).toBe(`Prova|${NOREPLY}|Prova|${NOREPLY}`)
    expect(git(app2, ['log', '--format=%ae|%ce'])).toBe(`${NOREPLY}|${NOREPLY}`)
    expect(git(app2, ['config', '--local', 'user.email'])).toBe(NOREPLY)   // els commits següents del clon també
    expect(git(app2, ['config', '--local', 'user.name'])).toBe('Prova')
    expect(r.stdout).toContain(`commit inicial amb Prova <${NOREPLY}>\n`)
    expect(git(app2, ['config', '--get', 'remote.origin.url'])).toBe('https://github.com/suburlabs/prova.git')   // get-url aplicaria insteadOf
    expect(r.stdout).not.toMatch(/Queda a mà:[\s\S]*repositori a GitHub/)
  })
})
