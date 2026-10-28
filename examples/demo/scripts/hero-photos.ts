import config from '@payload-config'
import { heroPhotos } from '@suburlabs/core/seed'
import { getPayload } from 'payload'

import { media } from '../src/site/seed/media'
import { siteConfig } from '../src/site/site.config'

// Els fitxers de les escenes, en l'ordre de les escenes, surten del manifest de mitjans de la llavor.
const beatFiles = (['heroWorkshop', 'heroKitchen', 'heroBath', 'heroDone'] as const).map((k) => media.items[k].file)

await heroPhotos({ beatFiles, payload: await getPayload({ config }), siteConfig })
process.exit(0)
