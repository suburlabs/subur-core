import { siFacebook, siInstagram, siWhatsapp } from 'simple-icons'

import { footerLink } from '../../Footer/footerLink.js'
import type { SiteSettings } from '../../types/subur-types.js'
import { cn } from '../../utilities/ui.js'

type Social = NonNullable<SiteSettings['socials']>[number]

// Una sola font per a les marques (craft floor: «un traç i un pes
// consistents»): `simple-icons`. Lucide no porta el símbol de WhatsApp i
// els de Facebook i Instagram hi són obsolets. El selector del CMS
// (`site-settings.socials.platform`) no ofereix «LinkedIn»: `simple-icons`
// no en distribueix la marca (cap export `siLinkedin*` a
// node_modules/simple-icons/index.d.ts, v16.32.0) i sense font d'icona
// l'enllaç es renderitzava sense glif.
const ICONS: Record<Social['platform'], { label: string; path: string }> = {
  facebook: { label: 'Facebook', path: siFacebook.path },
  instagram: { label: 'Instagram', path: siInstagram.path },
  whatsapp: { label: 'WhatsApp', path: siWhatsapp.path },
}

/**
 * Enllaços socials que el client omple a Ajustes de la web → Redes sociales
 * (`site-settings.socials`, no localitzat). Cada entrada es renderitza només
 * si té URL: no s'inventa res per a les plataformes on el client encara no
 * té perfil. Sense cap entrada, no es renderitza res.
 */
export function SocialLinks({ socials }: { socials?: Social[] | null }) {
  const items = (socials ?? []).flatMap((social) => {
    if (!social.url) return []
    const icon = ICONS[social.platform]
    return [{ id: social.id, label: icon.label, path: icon.path, url: social.url }]
  })

  if (items.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-1">
      {items.map((item, index) => (
        <li key={item.id ?? index}>
          <a
            aria-label={item.label}
            className={cn(footerLink, 'flex size-11 items-center justify-center')}
            href={item.url}
            rel="noopener noreferrer"
          >
            <svg aria-hidden="true" className="size-5" fill="currentColor" viewBox="0 0 24 24">
              <path d={item.path} />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  )
}
