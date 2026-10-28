import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSuburConfig } from '@suburlabs/core/config'

import { siteConfig } from './site/site.config.js'

export default buildSuburConfig(siteConfig, { baseDir: path.dirname(fileURLToPath(import.meta.url)) })
