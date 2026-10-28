import type { EmailField, TextField } from '@payloadcms/plugin-form-builder/types'

import { Field, FieldError, FieldLabel } from '../../../components/ui/field.js'
import { Input } from '../../../components/ui/input.js'

import { fieldSpan } from './span.js'
import { errorMessage, type FieldProps } from './types.js'

type Props = (EmailField | TextField) & FieldProps & { inputType?: 'email' | 'text' }

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Text({ errors, inputType = 'text', label, labels, name, register, required, width }: Props) {
  const hasError = Boolean(errors[name])

  return (
    <Field className={fieldSpan(width)} data-invalid={hasError || undefined}>
      <FieldLabel htmlFor={name}>
        {label}
        {required && <span aria-hidden="true" className="text-primary"> *</span>}
      </FieldLabel>
      <Input
        aria-describedby={hasError ? `${name}-error` : undefined}
        aria-invalid={hasError}
        aria-required={required || undefined}
        autoComplete={inputType === 'email' ? 'email' : name === 'nombre' ? 'name' : undefined}
        className="h-12 rounded-sm border-[1.5px] border-input bg-card text-base"
        id={name}
        type={inputType}
        {...register(name, {
          pattern: inputType === 'email' ? { message: labels.invalidEmail, value: EMAIL_PATTERN } : undefined,
          required: required ? labels.required : false,
        })}
      />
      {hasError && (
        <FieldError id={`${name}-error`} role="alert">
          {errorMessage(errors, name, labels.required)}
        </FieldError>
      )}
    </Field>
  )
}
