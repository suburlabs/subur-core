import config from '@payload-config'
import { createLocaleLayout } from '@suburlabs/core/app'

import { fontVariables } from '@/site/fonts'
import '../globals.css'

// Literals perquè Next els llegeix de manera estàtica: cap pàgina es genera en compilar (el build de Docker no té base
// de dades) i `revalidate` és el termini de stale-while-revalidate de l'HTML.
export const revalidate = 86400
export function generateStaticParams() {
  return []
}
const { Layout, metadata, viewport } = createLocaleLayout({ config, fontVariables })
export { metadata, viewport }
export default Layout
