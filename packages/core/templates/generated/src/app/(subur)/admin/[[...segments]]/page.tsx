import config from '@payload-config'
import { createAdminPage } from '@suburlabs/core/app/admin'

import { importMap } from '../importMap'

const { Page, generateMetadata } = createAdminPage({ config, importMap })
export { generateMetadata }
export default Page
