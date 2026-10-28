import { buildSuburConfig } from '@suburlabs/core/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { siteConfig } from './site/site.config'

export default buildSuburConfig(siteConfig, { baseDir: path.dirname(fileURLToPath(import.meta.url)) })
