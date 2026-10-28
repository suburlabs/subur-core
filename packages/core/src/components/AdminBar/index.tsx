'use client'

import type { PayloadAdminBarProps, PayloadMeUser } from '@payloadcms/admin-bar'

import { PayloadAdminBar } from '@payloadcms/admin-bar'
import { useRouter } from 'next/navigation'
import React, { useCallback, useState } from 'react'

import { getClientSideURL } from '../../utilities/getURL.js'
import { cn } from '../../utilities/ui.js'

import './index.scss'

export const AdminBar: React.FC<{ adminBarProps?: PayloadAdminBarProps }> = ({ adminBarProps }) => {
  const [show, setShow] = useState(false)
  const router = useRouter()

  const onAuthChange = useCallback((user: PayloadMeUser) => {
    setShow(Boolean(user?.id))
  }, [])

  return (
    <div className={cn('admin-bar py-2 bg-foreground text-background', show ? 'block' : 'hidden')}>
      <div className="container">
        <PayloadAdminBar
          {...adminBarProps}
          className="py-2"
          cmsURL={getClientSideURL()}
          // Fix en castellà a posta. `collectionLabels` només accepta cadenes
          // (vegeu `PayloadAdminBarProps` a `@payloadcms/admin-bar`), i aquesta
          // barra viu a la web pública, fora dels proveïdors del panell: aquí no
          // hi ha ni l'idioma d'administració de qui mira ni cap manera de
          // demanar-lo sense llegir la petició, que trencaria el render estàtic.
          collectionLabels={{ plural: 'Páginas', singular: 'Página' }}
          collectionSlug="pages"
          logo={<span>Subur</span>}
          onAuthChange={onAuthChange}
          onPreviewExit={() => {
            fetch('/next/exit-preview').then(() => {
              router.push('/')
              router.refresh()
            })
          }}
          style={{
            backgroundColor: 'transparent',
            padding: 0,
            position: 'relative',
            zIndex: 'unset',
          }}
        />
      </div>
    </div>
  )
}
