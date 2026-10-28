const SPACE = 32

/**
 * Només camins d'aquest mateix lloc. `//host` i `/\host` comencen per `/`
 * però el navegador els resol cap a un altre origen, i els caràcters de
 * control (tabulació, salt de línia) els descarta abans de resoldre: qualsevol
 * d'ells convertiria la previsualització en una redirecció oberta.
 */
export function isSafePreviewPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return false

  return [...path].every((char) => char.charCodeAt(0) >= SPACE)
}
