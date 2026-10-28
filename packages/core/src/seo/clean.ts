/**
 * Treu d'un node JSON-LD les claus sense valor: Google penalitza més una clau
 * buida que la seva absència. Compartit pel graf del layout i el de la pàgina.
 */
export const clean = <T extends Record<string, unknown>>(obj: T): T =>
  Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as T
