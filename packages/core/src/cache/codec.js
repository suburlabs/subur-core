// src/cache/codec.js — serialització dels valors de Next (spec §26.3) cap a text i tornada.
//
// `Buffer` → `{ __b64 }` i el `Map` de segments → `{ __map: [k, v][] }`, amb un
// recorregut explícit abans de `JSON.stringify`: el `toJSON` de `Buffer`
// s'executa abans que el *replacer*, així que un *replacer* no els veuria mai.
const b64 = (buf) => ({ __b64: Buffer.from(buf).toString('base64') })
const isBuf = (v) => Buffer.isBuffer(v) || v instanceof Uint8Array

export function encodeValue(value) {
  const out = { ...value }
  if (isBuf(out.rscData)) out.rscData = b64(out.rscData)
  if (isBuf(out.body)) out.body = b64(out.body)
  if (out.segmentData instanceof Map) {
    out.segmentData = { __map: [...out.segmentData].map(([k, v]) => [k, isBuf(v) ? b64(v) : v]) }
  }
  return JSON.stringify(out)
}

export function decodeValue(text) {
  const v = JSON.parse(text)
  const un = (x) => (x && typeof x === 'object' && typeof x.__b64 === 'string' ? Buffer.from(x.__b64, 'base64') : x)
  if (v.rscData) v.rscData = un(v.rscData)
  if (v.body) v.body = un(v.body)
  if (v.segmentData && v.segmentData.__map) v.segmentData = new Map(v.segmentData.__map.map(([k, x]) => [k, un(x)]))
  return v
}
