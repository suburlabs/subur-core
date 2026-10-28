import config from '@payload-config'
import { createAdminNotFound } from '@suburlabs/core/app/admin'

import { importMap } from '../importMap'

const { NotFound, generateMetadata } = createAdminNotFound({ config, importMap })
export { generateMetadata }
export default NotFound
