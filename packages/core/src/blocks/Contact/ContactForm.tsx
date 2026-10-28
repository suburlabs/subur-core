'use client'

import type { Form as FormType } from '@payloadcms/plugin-form-builder/types'
import type { DefaultTypedEditorState } from '@payloadcms/richtext-lexical'
import { Send } from 'lucide-react'
import { useState } from 'react'
import { type FieldValues, FormProvider, useForm } from 'react-hook-form'

import { trackEvent } from '../../analytics/track.js'
import RichText from '../../components/RichText/index.js'
import { Button } from '../../components/ui/button.js'
import type { Locale } from '../../i18n/config.js'
import { Plaque } from '../../ui/index.js'

import { fields } from './fields/index.js'
import type { ContactFormLabels } from './fields/types.js'
import { HONEYPOT_FIELD, isHoneypotFilled, toSubmissionData } from './submission.js'

type Props = {
  form: FormType
  labels: ContactFormLabels
  locale: Locale
}

export function ContactForm({ form, labels, locale }: Props) {
  const methods = useForm<FieldValues>()
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = methods
  const [status, setStatus] = useState<'error' | 'idle' | 'success'>('idle')

  const onSubmit = async (data: FieldValues) => {
    if (isHoneypotFilled(data)) {
      setStatus('success')
      return
    }

    try {
      const response = await fetch('/api/form-submissions', {
        body: JSON.stringify({ form: form.id, submissionData: toSubmissionData(data) }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      })
      if (response.ok) trackEvent('contact-form')
      setStatus(response.ok ? 'success' : 'error')
    } catch {
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <Plaque className="text-lead" size="lg">
        <div role="status">
          {form.confirmationType === 'message' && form.confirmationMessage ? (
            <RichText
              data={form.confirmationMessage as DefaultTypedEditorState}
              enableGutter={false}
              enableProse={false}
              locale={locale}
            />
          ) : (
            <p>{labels.success}</p>
          )}
        </div>
      </Plaque>
    )
  }

  return (
    <FormProvider {...methods}>
      <form className="relative grid grid-cols-1 gap-6 sm:grid-cols-2" noValidate onSubmit={handleSubmit(onSubmit)}>
        {form.fields?.map((field, index) => {
          const Field = fields[field.blockType as keyof typeof fields] as
            | React.ComponentType<Record<string, unknown>>
            | undefined
          if (!Field) return null
          return (
            <Field
              key={'name' in field ? field.name : index}
              {...field}
              errors={errors}
              inputType={field.blockType === 'email' ? 'email' : undefined}
              labels={labels}
              locale={locale}
              register={register}
            />
          )
        })}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor={HONEYPOT_FIELD}>No rellenar</label>
          <input autoComplete="off" id={HONEYPOT_FIELD} tabIndex={-1} type="text" {...register(HONEYPOT_FIELD)} />
        </div>
        {status === 'error' && (
          <p className="font-semibold text-destructive sm:col-span-2" role="alert">
            {labels.error}
          </p>
        )}
        <Button className="justify-self-start sm:col-span-2" disabled={isSubmitting} size="lg" type="submit">
          <Send />
          {form.submitButtonLabel}
        </Button>
      </form>
    </FormProvider>
  )
}
