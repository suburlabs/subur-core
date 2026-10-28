import config from '@payload-config'
import '@payloadcms/next/css'
import { createGraphqlHandlers } from '@suburlabs/core/app/admin'

export const { GET } = createGraphqlHandlers(config).playground
