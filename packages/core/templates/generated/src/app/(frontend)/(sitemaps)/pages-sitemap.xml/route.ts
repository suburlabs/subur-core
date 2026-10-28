import config from '@payload-config'
import { createSitemapRoutes } from '@suburlabs/core/app'

export const { GET } = createSitemapRoutes({ config }).pages
