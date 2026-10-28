import config from '@payload-config'
import { createLlmsRoute } from '@suburlabs/core/app'

export const { GET } = createLlmsRoute({ config })
