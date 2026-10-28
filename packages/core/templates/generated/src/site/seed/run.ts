import config from '@payload-config'
import { runSeed } from '@suburlabs/core/seed'
import { getPayload } from 'payload'

import { siteConfig } from '../site.config'
import { content } from './content'
import { media } from './media'

const payload = await getPayload({ config })
await runSeed({ content, media, payload, siteConfig })
process.exit(0)
