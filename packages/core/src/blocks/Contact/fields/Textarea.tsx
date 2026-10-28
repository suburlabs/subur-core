import type { TextAreaField } from '@payloadcms/plugin-form-builder/types'

import { Field, FieldError, FieldLabel } from '../../../components/ui/field.js'
import { Textarea as TextareaUi } from '../../../components/ui/textarea.js'

import { fieldSpan } from './span.js'
import { errorMessage, type FieldProps } from './types.js'

export function Textarea({ errors, label, labels, name, register, required, width }: TextAreaField & FieldProps) {
  const hasError = Boolean(errors[name])

  return (
    <Field className={fieldSpan(width)} data-invalid={hasError || undefined}>
      <FieldLabel htmlFor={name}>
        {label}
        {required && <span aria-hidden="true" className="text-primary"> *</span>}
      </FieldLabel>
      <TextareaUi
        aria-describedby={hasError ? `${name}-error` : undefined}
        aria-invalid={hasError}
        aria-required={required || undefined}
        className="min-h-40 rounded-sm border-[1.5px] border-input bg-card text-base"
        id={name}
        rows={6}
        {...register(name, { required: required ? labels.required : false })}
      />
      {hasError && (
        <FieldError id={`${name}-error`} role="alert">
          {errorMessage(errors, name, labels.required)}
        </FieldError>
      )}
    </Field>
  )
}
