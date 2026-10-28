import type { GlobalConfig } from 'payload'

import { invalidateGlobalAfterChange } from '../hooks/invalidateSiteCache.js'
import { adminLabel } from '../i18n/adminLabel.js'
import { uiDefaults, uiKeys } from '../i18n/uiDefaults.js'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  access: {
    read: () => true,
  },
  typescript: { interface: 'SiteSettings' },
  label: adminLabel({ ca: 'Ajustos del web', en: 'Site settings', es: 'Ajustes de la web' }),
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: adminLabel({ ca: 'Contacte', en: 'Contact', es: 'Contacto' }),
          fields: [
            {
              type: 'row',
              fields: [
                {
                  name: 'phone',
                  type: 'text',
                  label: adminLabel({ ca: 'Telèfon', en: 'Phone', es: 'Teléfono' }),
                  required: true,
                },
                {
                  name: 'email',
                  type: 'email',
                  label: adminLabel({ ca: 'Email', en: 'Email', es: 'Email' }),
                  required: true,
                },
              ],
            },
            {
              name: 'address',
              type: 'textarea',
              label: adminLabel({ ca: 'Adreça', en: 'Address', es: 'Dirección' }),
              localized: true,
              required: true,
            },
            {
              name: 'hours',
              type: 'text',
              label: adminLabel({ ca: 'Horari d’atenció', en: 'Opening hours', es: 'Horario de atención' }),
              localized: true,
              required: true,
            },
            {
              name: 'location',
              type: 'group',
              admin: {
                description: adminLabel({
                  ca: 'Adreça estructurada per a Google (dades estructurades schema.org). L’adreça de dalt és la que es mostra a la pàgina; aquesta, la que llegeixen els cercadors.',
                  en: 'Structured address for Google (schema.org structured data). The address above is what the page shows; this is what search engines read.',
                  es: 'Dirección estructurada para Google (datos estructurados schema.org). La dirección de arriba es la que se muestra en la página; esta, la que leen los buscadores.',
                }),
              },
              label: adminLabel({ ca: 'Ubicació (SEO local)', en: 'Location (local SEO)', es: 'Ubicación (SEO local)' }),
              fields: [
                {
                  name: 'streetAddress',
                  type: 'text',
                  label: adminLabel({ ca: 'Carrer i número', en: 'Street address', es: 'Calle y número' }),
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'postalCode',
                      type: 'text',
                      label: adminLabel({ ca: 'Codi postal', en: 'Postal code', es: 'Código postal' }),
                    },
                    {
                      name: 'addressLocality',
                      type: 'text',
                      label: adminLabel({ ca: 'Població', en: 'Locality', es: 'Población' }),
                    },
                    {
                      name: 'addressRegion',
                      type: 'text',
                      label: adminLabel({ ca: 'Província', en: 'Region', es: 'Provincia' }),
                    },
                    {
                      name: 'addressCountry',
                      type: 'text',
                      admin: {
                        description: adminLabel({
                          ca: 'Codi de dues lletres, p. ex. ES',
                          en: 'Two-letter code, e.g. ES',
                          es: 'Código de dos letras, p. ej. ES',
                        }),
                      },
                      label: adminLabel({ ca: 'País', en: 'Country', es: 'País' }),
                      validate: (value: null | string | undefined) =>
                        !value || /^[A-Z]{2}$/.test(value) || 'Código ISO de dos letras en mayúsculas (ES).',
                    },
                  ],
                },
                {
                  name: 'geo',
                  type: 'group',
                  label: adminLabel({ ca: 'Coordenades', en: 'Coordinates', es: 'Coordenadas' }),
                  fields: [
                    {
                      type: 'row',
                      fields: [
                        {
                          name: 'latitude',
                          type: 'number',
                          label: adminLabel({ ca: 'Latitud', en: 'Latitude', es: 'Latitud' }),
                          max: 90,
                          min: -90,
                        },
                        {
                          name: 'longitude',
                          type: 'number',
                          label: adminLabel({ ca: 'Longitud', en: 'Longitude', es: 'Longitud' }),
                          max: 180,
                          min: -180,
                        },
                      ],
                    },
                  ],
                },
                {
                  name: 'areaServed',
                  type: 'array',
                  label: adminLabel({
                    ca: 'Zones on es treballa',
                    en: 'Areas served',
                    es: 'Zonas donde se trabaja',
                  }),
                  labels: {
                    plural: adminLabel({ ca: 'Zones', en: 'Areas', es: 'Zonas' }),
                    singular: adminLabel({ ca: 'Zona', en: 'Area', es: 'Zona' }),
                  },
                  localized: true,
                  fields: [
                    {
                      name: 'name',
                      type: 'text',
                      label: adminLabel({ ca: 'Nom', en: 'Name', es: 'Nombre' }),
                      required: true,
                    },
                  ],
                },
                {
                  name: 'priceRange',
                  type: 'text',
                  admin: {
                    description: adminLabel({
                      ca: 'Opcional: indicació de preus per a Google, p. ex. «€€». Si es deixa buit, no es publica.',
                      en: 'Optional: price indication for Google, e.g. "€€". If left empty, it is not published.',
                      es: 'Opcional: indicación de precios para Google, p. ej. «€€». Si se deja vacío, no se publica.',
                    }),
                  },
                  label: adminLabel({ ca: 'Rang de preus', en: 'Price range', es: 'Rango de precios' }),
                  maxLength: 20,
                },
              ],
            },
            {
              name: 'socials',
              type: 'array',
              label: adminLabel({ ca: 'Xarxes socials', en: 'Social networks', es: 'Redes sociales' }),
              labels: {
                plural: adminLabel({ ca: 'Xarxes', en: 'Networks', es: 'Redes' }),
                singular: adminLabel({ ca: 'Xarxa', en: 'Network', es: 'Red' }),
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'platform',
                      type: 'select',
                      label: adminLabel({ ca: 'Xarxa', en: 'Network', es: 'Red' }),
                      options: [
                        {
                          label: adminLabel({ ca: 'Instagram', en: 'Instagram', es: 'Instagram' }),
                          value: 'instagram',
                        },
                        {
                          label: adminLabel({ ca: 'Facebook', en: 'Facebook', es: 'Facebook' }),
                          value: 'facebook',
                        },
                        {
                          label: adminLabel({ ca: 'WhatsApp', en: 'WhatsApp', es: 'WhatsApp' }),
                          value: 'whatsapp',
                        },
                      ],
                      required: true,
                    },
                    {
                      name: 'url',
                      type: 'text',
                      label: adminLabel({ ca: 'URL', en: 'URL', es: 'URL' }),
                      required: true,
                    },
                  ],
                },
              ],
            },
            {
              name: 'googleBusinessProfile',
              type: 'text',
              admin: {
                description: adminLabel({
                  ca: 'Enllaç a la fitxa de Google Business Profile (surt a les dades estructurades).',
                  en: 'Link to the Google Business Profile listing (used in structured data).',
                  es: 'Enlace a la ficha de Google Business Profile (sale en los datos estructurados).',
                }),
              },
              label: adminLabel({ ca: 'Fitxa de Google', en: 'Google listing', es: 'Ficha de Google' }),
              validate: (value: null | string | undefined) =>
                !value || /^https:\/\//.test(value) || 'Debe empezar por https://.',
            },
          ],
        },
        {
          label: adminLabel({ ca: 'Marca', en: 'Brand', es: 'Marca' }),
          fields: [
            {
              name: 'logo',
              type: 'upload',
              admin: {
                description: adminLabel({
                  ca: 'Si es deixa buit, s’utilitza el logotip per defecte del web.',
                  en: 'If left empty, the site uses the default logo.',
                  es: 'Si se deja vacío, se usa el logo por defecto de la web.',
                }),
              },
              label: adminLabel({ ca: 'Logo', en: 'Logo', es: 'Logo' }),
              relationTo: 'media',
            },
          ],
        },
        {
          label: adminLabel({ ca: 'Textos de la interfície', en: 'Interface strings', es: 'Textos de la interfaz' }),
          fields: [
            {
              name: 'ui',
              type: 'group',
              admin: {
                description: adminLabel({
                  ca: 'Textos curts de botons, menús i formularis. Si en deixa un buit, el web utilitza el text estàndard en aquest idioma.',
                  en: 'Short texts for buttons, menus and forms. If you leave one empty, the site uses the standard text in that language.',
                  es: 'Textos cortos de botones, menús y formularios. Si deja uno vacío, la web usa el texto estándar en ese idioma.',
                }),
                hideGutter: true,
              },
              label: false,
              fields: uiKeys.map((key) => ({
                name: key,
                type: 'text' as const,
                label: uiDefaults[key].label,
                localized: true,
              })),
            },
          ],
        },
      ],
    },
  ],
  hooks: {
    afterChange: [invalidateGlobalAfterChange],
  },
}
