/**
 * Retenció dels registres de consentiment (spec §22.6). Decisió jurídica
 * provisional: la pot ajustar qui signi els textos legals.
 * - Un consentiment val `CONSENT_VALIDITY_DAYS`: és també el `validUntil` que
 *   hi posa la política de c15t (`src/consent/backend.ts`); els registres
 *   sense `validUntil` (anteriors a la política) es tracten igual.
 *   **Canviar-lo reinicia el consentiment desat de tots els visitants i torna
 *   a mostrar-los el bàner**: entra a l'empremta de la política que el client
 *   compara a cada visita (vegeu el comentari de `policyPacks` a
 *   `backend.ts`).
 * - La prova es guarda `CONSENT_PROOF_RETENTION_YEARS` més: la prescripció de
 *   les infraccions molt greus de la LOPDGDD (art. 72). No és a la política
 *   de c15t: es pot canviar sense cap efecte sobre el bàner.
 */
export const CONSENT_VALIDITY_DAYS = 365
export const CONSENT_PROOF_RETENTION_YEARS = 3

type Db = { query: (sql: string, params?: unknown[]) => Promise<{ rowCount: null | number }> }

/**
 * Esborra en l'ordre que imposen les claus foranes (`ON DELETE RESTRICT`,
 * `docs/operacio/consentiment.md`): consentiments, rastre d'auditoria i, al
 * final, els subjectes que s'han quedat sense res. S'ha de cridar dins d'una
 * transacció.
 *
 * Les dates de `c15t_*` són `timestamp without time zone`
 * (`src/migrations/20260926_090554_c15t.ts`) i c15t les escriu amb un `Date`
 * a través de `pg`, que el converteix a l'hora local del procés. `now` fa el
 * mateix camí (un `Date` com a paràmetre, convertit a `timestamp`), de manera
 * que es compara en la mateixa referència que les files, sense dependre de la
 * zona horària de la sessió de Postgres.
 */
export async function purgeExpiredConsent(db: Db, now: Date) {
  const params = [now, `${CONSENT_VALIDITY_DAYS} days`, `${CONSENT_PROOF_RETENTION_YEARS} years`]
  const consents = await db.query(
    `delete from c15t_consent
      where coalesce("validUntil", "givenAt" + $2::interval) < $1::timestamp - $3::interval`,
    params,
  )
  const auditLogs = await db.query(
    `delete from "c15t_auditLog"
      where "createdAt" < $1::timestamp - $2::interval - $3::interval`,
    params,
  )
  const subjects = await db.query(
    `delete from c15t_subject s
      where s."createdAt" < $1::timestamp - $2::interval - $3::interval
        and not exists (select 1 from c15t_consent c where c."subjectId" = s.id)
        and not exists (select 1 from "c15t_auditLog" a where a."subjectId" = s.id)`,
    params,
  )
  return {
    auditLogs: auditLogs.rowCount ?? 0,
    consents: consents.rowCount ?? 0,
    subjects: subjects.rowCount ?? 0,
  }
}
