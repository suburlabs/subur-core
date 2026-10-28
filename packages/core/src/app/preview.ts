import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { getPayload, type PayloadRequest } from 'payload'

import { isSafePreviewPath } from '../utilities/isSafePreviewPath.js'
import type { ConfigArg } from './siteData.js'

export type PreviewSearchParams = {
  path: string
  previewSecret: string
}

/** `next/preview` activa el mode esborrany per a un usuari autenticat del CMS; `next/exit-preview` el desactiva. */
export function createPreviewRoutes({ config }: { config: ConfigArg }) {
  async function GET(req: NextRequest): Promise<Response> {
    const payload = await getPayload({ config })

    const { searchParams } = new URL(req.url)

    const path = searchParams.get('path')
    const previewSecret = searchParams.get('previewSecret')

    if (previewSecret !== process.env.PREVIEW_SECRET) {
      return new Response('You are not allowed to preview this page', { status: 403 })
    }

    if (!path) {
      return new Response('Insufficient search params', { status: 404 })
    }

    if (!isSafePreviewPath(path)) {
      return new Response('This endpoint can only be used for relative previews', { status: 400 })
    }

    let user

    try {
      const authResult = await payload.auth({
        req: req as unknown as PayloadRequest,
        headers: req.headers,
      })
      user = authResult.user
    } catch (error) {
      payload.logger.error({ err: error }, 'Error verifying token for live preview')
      return new Response('You are not allowed to preview this page', { status: 403 })
    }

    const draft = await draftMode()

    if (!user) {
      draft.disable()
      return new Response('You are not allowed to preview this page', { status: 403 })
    }

    draft.enable()

    redirect(path)
  }

  return {
    exitPreview: {
      async GET(): Promise<Response> {
        const draft = await draftMode()
        draft.disable()
        return new Response('Draft mode is disabled')
      },
    },
    preview: { GET },
  }
}
