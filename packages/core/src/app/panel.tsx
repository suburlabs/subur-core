import { RootLayout } from '@payloadcms/next/layouts'
import { generatePageMetadata, NotFoundPage, RootPage } from '@payloadcms/next/views'
import type { Metadata } from 'next'
import type { ImportMap, ServerFunctionClient } from 'payload'
import type { ReactNode } from 'react'

import type { ConfigArg } from './siteData.js'

// Cap import de CSS: `@payloadcms/next/css` i el SCSS propi del panell els fan els fitxers de ruta del grup (subur) (D29).

type ViewArgs = { params: Promise<{ segments: string[] }>; searchParams: Promise<Record<string, string | string[]>> }

/**
 * El `serverFunction` el declara el fitxer de ruta a nivell de mòdul (ruling P20): aquí no es captura res. Una acció de
 * servidor declarada dins de la fàbrica capturaria `config` (una promesa amb funcions) i `importMap` (components), que el
 * bundler hauria de serialitzar com a arguments lligats: el mòdul petaria en avaluar-se.
 */
export function createAdminLayout({ config, importMap, serverFunction }: { config: ConfigArg; importMap: ImportMap; serverFunction: ServerFunctionClient }) {
  return function AdminLayout({ children }: { children: ReactNode }) {
    return (
      <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
        {children}
      </RootLayout>
    )
  }
}

export function createAdminPage({ config, importMap }: { config: ConfigArg; importMap: ImportMap }) {
  return {
    generateMetadata: ({ params, searchParams }: ViewArgs): Promise<Metadata> => generatePageMetadata({ config, params, searchParams }),
    Page: ({ params, searchParams }: ViewArgs) => RootPage({ config, importMap, params, searchParams }),
  }
}

export function createAdminNotFound({ config, importMap }: { config: ConfigArg; importMap: ImportMap }) {
  return {
    generateMetadata: ({ params, searchParams }: ViewArgs): Promise<Metadata> => generatePageMetadata({ config, params, searchParams }),
    NotFound: ({ params, searchParams }: ViewArgs) => NotFoundPage({ config, importMap, params, searchParams }),
  }
}
