import config from '@payload-config'
import '@payloadcms/next/css'
import { createRestHandlers } from '@suburlabs/core/app/admin'

export const { DELETE, GET, OPTIONS, PATCH, POST, PUT } = createRestHandlers(config)
