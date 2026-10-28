import type { SeedContent } from '@suburlabs/core/seed'

import type { MediaKey } from '../media'
import { ca } from './ca'
import { en } from './en'
import { es } from './es'

export const pageSlugs = ['home', 'serveis', 'contacte', 'avis-legal', 'privacitat', 'cookies'] as const
export type PageSlug = (typeof pageSlugs)[number]
export const content: SeedContent<PageSlug, MediaKey> = { byLocale: { ca, en, es }, pageSlugs }
