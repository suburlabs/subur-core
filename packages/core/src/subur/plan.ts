import type { Plan } from './contract.js'

/** Un sol tipus de pla: el de la projecció `.subur/` (`contract.ts`), que és el que escriu `subscription.plan`. */
export type { Plan }

/**
 * Qualsevol valor que no sigui exactament `business` compta com a Starter: el pla que menys dona.
 * El pla no governa cap funcionalitat (ho fan els mòduls, `hasModule`); només el llegeix `/api/health`.
 */
export const resolvePlan = (value: unknown): Plan => (value === 'business' ? 'business' : 'starter')
