import { siteConfig } from 'subur-site-config'

export const name: string = siteConfig.name
// @ts-expect-error: name és string; si siteConfig fos any, aquesta directiva sobraria i tsc fallaria
export const wrong: number = siteConfig.name
