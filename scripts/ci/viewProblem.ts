// La comprovació d'una vista del panell de la sonda amb sessió d'acceptance.ts.
/**
 * El problema d'una vista del panell amb sessió, o '' si és sana: 200, sense redirecció dins del flux, sense cap marca
 * d'error del render i amb la seva marca positiva. Pura i en un mòdul propi perquè es provi sense contenidor (viewProblem.test.ts;
 * mutació A1f de l'onada final).
 */
export function viewProblem(status: number, body: string, marker: string): string {
  // A l'HTML, les files del flux RSC van dins de `self.__next_f.push([1,"…"])` passades per JSON.stringify: un error hi surt
  // com a `\"digest\"`, no `"digest"`; el de l'SSR, com a `<template data-dgst="…">` (sense el BAILOUT de `ssr: false`,
  // que no és cap error), i el d'una frontera en flux, com a la crida `$RX(` (mutació A1f de l'onada final). La crida, no
  // el nom: el runtime sa de React porta `$RX.bind(` a cada pàgina (F1 de la re-revisió; ronda 3 de la T20).
  const error = body.match(/\\?"digest\\?"|\bdata-dgst="(?!BAILOUT_TO_CLIENT_SIDE_RENDERING")|\$RX\(|NEXT_HTTP_ERROR_FALLBACK/)
  if (status !== 200) return `HTTP ${status}`
  if (body.includes('NEXT_REDIRECT')) return 'redirigeix'
  if (error) return `marca d'error ${error[0]}`
  return body.includes(marker) ? '' : `sense «${marker}»`
}
