// Els casos de la mutació A1f de l'onada final, més el del runtime sa de React (F1): la sonda amb sessió d'acceptance.ts.
import { describe, expect, it } from 'vitest'

import { viewProblem } from './viewProblem.js'

const ok = (body: string) => viewProblem(200, `${body}<p>Marca</p>`, 'Marca')

describe('viewProblem: una vista del panell amb sessió', () => {
  it('sana: 200, sense marques d\'error i amb la seva marca', () => expect(ok('<html>')).toBe(''))
  it('sense la marca positiva', () => expect(viewProblem(200, '<html>sense marca</html>', 'Marca')).toBe('sense «Marca»'))
  it('un estat que no és 200', () => expect(viewProblem(500, '<p>Marca</p>', 'Marca')).toBe('HTTP 500'))
  it('la redirecció dins del flux', () => expect(ok('self.__next_f.push([1,"NEXT_REDIRECT;replace;/admin/login;307;"])')).toBe('redirigeix'))
  it('un error del flux RSC, sense escapar i escapat dins de push([1,"…"])', () => {
    expect(ok('5:E{"digest":"2392875"}')).toBe('marca d\'error "digest"')
    expect(ok('self.__next_f.push([1,"5:E{\\"digest\\":\\"2392875\\"}"])')).toBe('marca d\'error \\"digest\\"')
  })
  it('un error de l\'SSR (data-dgst), però no el BAILOUT de ssr:false', () => {
    expect(ok('<template data-dgst="2392875"></template>')).toBe('marca d\'error data-dgst="')
    expect(ok('<template data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING"></template>')).toBe('')
  })
  it('una frontera d\'error en flux: la crida $RX(', () => expect(ok('<script>$RX("B:0","2392875")</script>')).toBe('marca d\'error $RX('))
  it('el runtime sa de React ($RX.bind) no és cap error (F1)', () => {
    expect(ok('<script>$RR=function(){};$RX.bind(null,n,"CSS failed to load")</script>')).toBe('')
  })
  it('notFound dins del flux', () => expect(ok('self.__next_f.push([1,"NEXT_HTTP_ERROR_FALLBACK;404"])')).toBe('marca d\'error NEXT_HTTP_ERROR_FALLBACK'))
})
