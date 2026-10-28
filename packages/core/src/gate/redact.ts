/** Línies de la porta sense secrets (les tres regles de scripts/ops/redact.ts que la porta necessita). */
export const REDACTED = '<redactat>'
export function redactLine(text: string): string {
  return text
    .replace(/\b([A-Z][A-Z0-9_]*)=(?!<redactat>$).*$/gm, `$1=${REDACTED}`)
    .replace(/([a-z]+:\/\/[^:\s/]+:)[^@\s]+@/g, `$1${REDACTED}@`)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/g, `Bearer ${REDACTED}`)
    .replace(/\beyJ[A-Za-z0-9_-]{10,}/g, REDACTED)
}
