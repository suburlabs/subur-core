import { defineSiteConfig } from '@suburlabs/core/site'

export const siteConfig = defineSiteConfig({
  assets: {
    favicon: '/site/logo-mark.svg',
    heroFilm: {
      duration: 8,
      posters: [1, 2, 3, 4].map((n) => ({ height: 720, src: `/site/hero/poster-${n}.webp`, width: 1276 })),
      src: '/site/hero/film.mp4',
      srcMobile: '/site/hero/film-m.mp4',
    },
    logo: '/site/logo-lockup.webp',
    logoMark: '/site/logo-mark.svg',
    logoSize: { height: 120, width: 480 },
  },
  clientLocale: 'ca',
  defaultLocale: 'es',
  domain: 'fixture.example',
  id: 'fixture',
  legalSlugs: { cookies: 'cookies', legalNotice: 'avis-legal', privacy: 'privacitat' },
  name: 'Web de Prova',
  optionalBlocks: { scrollHero: true, taskCatalog: true },
  seo: { schemaType: 'LocalBusiness' },
  themeColor: { dark: '#101418', light: '#f6f6f4' },
})
