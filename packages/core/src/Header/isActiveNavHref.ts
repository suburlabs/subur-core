/**
 * Un ítem és actiu a la seva pàgina i a les que en pengen. L'inici d'un idioma
 * (`/ca`) n'és l'excepció: totes les rutes en pengen, i marcar-lo sempre actiu
 * no diria res a ningú.
 */
export function isActiveNavHref(pathname: string, href: string): boolean {
  if (pathname === href) return true

  const isLocaleHome = href.split('/').filter(Boolean).length <= 1

  return !isLocaleHome && pathname.startsWith(`${href}/`)
}
