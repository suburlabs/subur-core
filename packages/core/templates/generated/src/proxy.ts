import { proxy } from '@suburlabs/core/proxy'

export default proxy
// Literal: Next el llegeix de manera estàtica. `_subur` hi és perquè els assets del paquet no passin pel proxy.
export const config = { matcher: ['/((?!admin|api|_next|_subur|next/|.*\\..*).*)'] }
