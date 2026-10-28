import config from '@payload-config'
import { createSlugPage } from '@suburlabs/core/app'

export function generateStaticParams() {
  return []
}
const { Page, generateMetadata } = createSlugPage({ config })
export { generateMetadata }
export default Page
