import { createConsentRoute } from '@suburlabs/core/app'

// Ruta dinàmica: el backend del consentiment mai s'ha de prerenderitzar ni desar a la memòria cau.
export const dynamic = 'force-dynamic'
const { handler } = createConsentRoute()
export { handler as DELETE, handler as GET, handler as PATCH, handler as POST, handler as PUT }
