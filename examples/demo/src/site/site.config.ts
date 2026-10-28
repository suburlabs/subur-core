import { defineSiteConfig } from '@suburlabs/core/site'

export const siteConfig = defineSiteConfig({
  assets: {
    favicon: '/site/logo-mark.svg',
    heroFilm: {
      // La durada real del film (194 fotogrames a 24 fps): l'escenari hi mapeja l'scroll. Canvia-la amb el film.
      duration: 8.083333,
      posters: [1, 2, 3, 4].map((n) => ({ height: 720, src: `/site/hero/poster-${n}.webp`, width: 1280 })),
      src: '/site/hero/film.mp4',
      srcMobile: '/site/hero/film-m.mp4',
    },
    logo: '/site/logo-lockup.webp',
    logoMark: '/site/logo-mark.svg',
    logoSize: { height: 160, width: 640 },
  },
  clientLocale: 'ca',
  defaultLocale: 'ca',
  domain: 'demo.example',
  id: 'demo',
  // Els slugs de les pàgines legals són els del contingut de mostra (src/site/seed/content/index.ts) i no són localitzats:
  // si els canvies, canvia'ls als dos llocs.
  legalSlugs: { cookies: 'cookies', legalNotice: 'avis-legal', privacy: 'privacitat' },
  name: "Reformes Exemple",
  optionalBlocks: { scrollHero: true, taskCatalog: true },
  seo: { schemaType: 'HomeAndConstructionBusiness' },
  themeColor: { dark: '#121a16', light: '#f4f3ef' },
})
