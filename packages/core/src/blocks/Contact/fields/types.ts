import type { FieldErrors, FieldValues, UseFormRegister } from 'react-hook-form'

export type ContactFormLabels = {
  error: string
  invalidEmail: string
  privacyHref: string
  privacyPolicy: string
  required: string
  success: string
}

export type FieldProps = {
  errors: FieldErrors<FieldValues>
  labels: ContactFormLabels
  register: UseFormRegister<FieldValues>
}

export const errorMessage = (errors: FieldErrors<FieldValues>, name: string, fallback: string) => {
  const message = errors[name]?.message
  return typeof message === 'string' && message ? message : fallback
}
