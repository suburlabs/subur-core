import config from '@payload-config'
import { createPreviewRoutes } from '@suburlabs/core/app'

export const { GET } = createPreviewRoutes({ config }).exitPreview
