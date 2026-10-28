import type { ContactEventName } from './contactEvent.js'

type UmamiWindow = { umami?: { track: (name: string) => void } }

/**
 * Envia un esdeveniment a Umami si l'script hi és. Sense consentiment
 * `measurement` (o sense les variables d'Umami) l'script no s'ha carregat i
 * això no fa res: el consentiment continua sent l'única porta.
 */
export function trackEvent(name: ContactEventName): void {
  if (typeof window === 'undefined') return
  ;(window as unknown as UmamiWindow).umami?.track(name)
}
