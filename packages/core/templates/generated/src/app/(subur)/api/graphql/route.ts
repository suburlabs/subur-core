import config from '@payload-config'
import { createGraphqlHandlers } from '@suburlabs/core/app/admin'

export const { OPTIONS, POST } = createGraphqlHandlers(config)
