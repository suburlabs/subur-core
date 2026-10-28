import { createSuburAssetsRoute } from '@suburlabs/core/app'

// Serveix `/_subur/*` (el `rewrite` de `withSubur`): les icones del panell i les miniatures dels blocs del paquet.
export const { GET } = createSuburAssetsRoute()
