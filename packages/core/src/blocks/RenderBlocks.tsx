import { siteConfig } from 'subur-site-config'

import type { Locale } from '../i18n/config.js'
import type { Page } from '../types/subur-types.js'
import type { ResolvedSiteSettings } from '../utilities/siteSettings.js'

import { isBlockEnabled } from './registry.js'
import { Contact } from './Contact/Component.js'
import { CtaBand } from './CtaBand/Component.js'
import { Faq } from './Faq/Component.js'
import { FeatureList } from './FeatureList/Component.js'
import { Note } from './Note/Component.js'
import { PageHero } from './PageHero/Component.js'
import { RichTextSection } from './RichTextSection/Component.js'
import { ScrollHero } from './ScrollHero/Component.js'
import { ServicesGrid } from './ServicesGrid/Component.js'
import { Statement } from './Statement/Component.js'
import { TaskCatalog } from './TaskCatalog/Component.js'
import { Testimonials } from './Testimonials/Component.js'

type Props = {
  blocks: Page['layout']
  locale: Locale
  settings: ResolvedSiteSettings
}

export function RenderBlocks({ blocks, locale, settings }: Props) {
  const context = { locale, settings }

  return (
    <>
      {blocks.map((block, index) => {
        // Un bloc desactivat a `optionalBlocks` no es pinta (spec §3.3), encara que ja sigui desat.
        if (!isBlockEnabled(block.blockType, siteConfig.optionalBlocks)) return null

        const key = block.id ?? `${block.blockType}-${index}`

        switch (block.blockType) {
          case 'scrollHero':
            return <ScrollHero key={key} {...block} {...context} />
          case 'pageHero':
            return <PageHero key={key} {...block} />
          case 'statement':
            return <Statement key={key} {...block} />
          case 'servicesGrid':
            return <ServicesGrid key={key} {...block} {...context} />
          case 'featureList':
            return <FeatureList key={key} {...block} {...context} />
          case 'testimonials':
            return <Testimonials key={key} {...block} {...context} />
          case 'taskCatalog':
            return <TaskCatalog key={key} {...block} />
          case 'note':
            return <Note key={key} {...block} />
          case 'ctaBand':
            return <CtaBand key={key} {...block} {...context} />
          case 'faq':
            return <Faq key={key} {...block} />
          case 'contact':
            return <Contact key={key} {...block} {...context} />
          case 'richTextSection':
            return <RichTextSection key={key} {...block} {...context} />
          default:
            return null
        }
      })}
    </>
  )
}
