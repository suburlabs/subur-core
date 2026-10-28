import config from '@payload-config'
import { createLocalePage } from '@suburlabs/core/app'

export function generateStaticParams() {
  return []
}
const { Page, generateMetadata } = createLocalePage({ config })
export { generateMetadata }
export default Page
