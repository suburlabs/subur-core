import { GRAPHQL_PLAYGROUND_GET, GRAPHQL_POST, REST_DELETE, REST_GET, REST_OPTIONS, REST_PATCH, REST_POST, REST_PUT } from '@payloadcms/next/routes'

import type { ConfigArg } from './siteData.js'

// Cap import de CSS: el fan els fitxers de ruta del grup (subur) (D29).

/** Les rutes REST del CMS (`api/[...slug]`): els sis mètodes. */
export const createRestHandlers = (config: ConfigArg) => ({
  DELETE: REST_DELETE(config),
  GET: REST_GET(config),
  OPTIONS: REST_OPTIONS(config),
  PATCH: REST_PATCH(config),
  POST: REST_POST(config),
  PUT: REST_PUT(config),
})

/** `api/graphql` (POST i OPTIONS) i `api/graphql-playground` (`playground.GET`). */
export const createGraphqlHandlers = (config: ConfigArg) => ({
  OPTIONS: REST_OPTIONS(config),
  playground: { GET: GRAPHQL_PLAYGROUND_GET(config) },
  POST: GRAPHQL_POST(config),
})
