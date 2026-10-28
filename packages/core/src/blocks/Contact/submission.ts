export const HONEYPOT_FIELD = 'empresa_web'
export const PRIVACY_FIELD = 'privacidad'

export const isHoneypotFilled = (data: Record<string, unknown>): boolean => {
  const value = data[HONEYPOT_FIELD]
  return typeof value === 'string' && value.trim() !== ''
}

export const toSubmissionData = (data: Record<string, unknown>) =>
  Object.entries(data)
    .filter(([field]) => field !== HONEYPOT_FIELD)
    .map(([field, value]) => ({
      field,
      value: typeof value === 'string' ? value : String(value ?? ''),
    }))
