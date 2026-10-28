import { resendAdapter } from '@payloadcms/email-resend'

type Env = Record<string, string | undefined>

/**
 * Correu sortint via Resend. Sense `RESEND_API_KEY` no hi ha adaptador: el CMS
 * desa igualment els enviaments del formulari i escriu el correu al log.
 * Amb clau però sense remitent, s'atura en arrencar: val més un error clar en
 * desplegar que avisos que no arriben mai.
 */
export function emailAdapter(env: Env = process.env): ReturnType<typeof resendAdapter> | undefined {
  const apiKey = env.RESEND_API_KEY?.trim()
  if (!apiKey) return undefined

  const fromAddress = env.EMAIL_FROM_ADDRESS?.trim()
  if (!fromAddress) {
    throw new Error('RESEND_API_KEY está definida pero falta EMAIL_FROM_ADDRESS.')
  }

  return resendAdapter({
    apiKey,
    defaultFromAddress: fromAddress,
    defaultFromName: env.EMAIL_FROM_NAME?.trim() || fromAddress,
  })
}
