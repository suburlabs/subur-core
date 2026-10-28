import type { Metadata } from 'next'

const defaultOpenGraph: Metadata['openGraph'] = {
  images: [{ height: 630, url: '/site/og-default.webp', width: 1200 }],
  type: 'website',
}

export const mergeOpenGraph = (og?: Metadata['openGraph']): Metadata['openGraph'] => {
  return {
    ...defaultOpenGraph,
    ...og,
  }
}
