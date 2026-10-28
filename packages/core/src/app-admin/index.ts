// Les fàbriques del grup (subur): el panell, REST i GraphQL (spec §3.1; D29). Cap mòdul del paquet importa
// `@payloadcms/next/css`: el fan els fitxers de ruta del client.
export { createGraphqlHandlers, createRestHandlers } from '../app/api.js'
export { createAdminLayout, createAdminNotFound, createAdminPage } from '../app/panel.js'
