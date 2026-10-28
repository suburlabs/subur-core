import type { Block } from 'payload'

import type { SiteConfig } from '../utilities/defineSiteConfig.js'

import { contactBlock } from './Contact/config.js'
import { ctaBandBlock } from './CtaBand/config.js'
import { faqBlock } from './Faq/config.js'
import { featureListBlock } from './FeatureList/config.js'
import { noteBlock } from './Note/config.js'
import { pageHeroBlock } from './PageHero/config.js'
import { richTextSectionBlock } from './RichTextSection/config.js'
import { scrollHeroBlock } from './ScrollHero/config.js'
import { servicesGridBlock } from './ServicesGrid/config.js'
import { statementBlock } from './Statement/config.js'
import { taskCatalogBlock } from './TaskCatalog/config.js'
import { testimonialsBlock } from './Testimonials/config.js'

/** Tots els blocs, sempre (spec §3.3): l'esquema és el mateix per a tots els clients. */
export const allLayoutBlocks: Block[] = [
  scrollHeroBlock,
  pageHeroBlock,
  statementBlock,
  servicesGridBlock,
  featureListBlock,
  testimonialsBlock,
  taskCatalogBlock,
  noteBlock,
  ctaBandBlock,
  faqBlock,
  contactBlock,
  richTextSectionBlock,
]

/** Els blocs opcionals i la clau d'`optionalBlocks` que els activa; la resta, sempre actius. */
const OPTIONAL: Record<string, keyof SiteConfig['optionalBlocks']> = { scrollHero: 'scrollHero', taskCatalog: 'taskCatalog' }

export const isBlockEnabled = (slug: string, optionalBlocks: SiteConfig['optionalBlocks']): boolean =>
  !Object.hasOwn(OPTIONAL, slug) || optionalBlocks[OPTIONAL[slug]] === true

/** Només filtra què pot afegir l'editor (`filterOptions` del camp `layout`); l'esquema no canvia. */
export const enabledBlockSlugs = (optionalBlocks: SiteConfig['optionalBlocks']): string[] =>
  allLayoutBlocks.map((b) => b.slug).filter((slug) => isBlockEnabled(slug, optionalBlocks))
