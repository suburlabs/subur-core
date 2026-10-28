'use client'

import type { CheckboxField } from '@payloadcms/plugin-form-builder/types'
import { Controller, useFormContext } from 'react-hook-form'

import { Checkbox as CheckboxUi } from '../../../components/ui/checkbox.js'
import { Field, FieldContent, FieldError, FieldLabel } from '../../../components/ui/field.js'

import { PRIVACY_FIELD } from '../submission.js'
import { errorMessage, type FieldProps } from './types.js'

export function Checkbox({ errors, label, labels, name, required }: CheckboxField & FieldProps) {
  const { control } = useFormContext()
  const hasError = Boolean(errors[name])

  return (
    <Field className="sm:col-span-2" data-invalid={hasError || undefined} orientation="horizontal">
      <Controller
        control={control}
        defaultValue={false}
        name={name}
        render={({ field }) => (
          <CheckboxUi
            aria-describedby={hasError ? `${name}-error` : undefined}
            aria-invalid={hasError}
            aria-required={required || undefined}
            checked={field.value === true}
            className="size-5 rounded-sm border-[1.5px] border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
            id={name}
            onCheckedChange={(checked) => field.onChange(checked === true)}
          />
        )}
        rules={{ validate: (value) => !required || value === true || labels.required }}
      />
      <FieldContent>
        <FieldLabel className="font-normal" htmlFor={name}>
          {label}
          {required && <span aria-hidden="true" className="text-primary"> *</span>}
        </FieldLabel>
        {name === PRIVACY_FIELD && (
          <a className="self-start text-sm font-semibold text-primary" href={labels.privacyHref} rel="noopener noreferrer" target="_blank">
            {labels.privacyPolicy}
          </a>
        )}
        {hasError && (
          <FieldError id={`${name}-error`} role="alert">
            {errorMessage(errors, name, labels.required)}
          </FieldError>
        )}
      </FieldContent>
    </Field>
  )
}
