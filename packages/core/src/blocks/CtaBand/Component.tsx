import { Mail, Phone } from 'lucide-react'

import { Button } from '../../components/ui/button.js'
import { Plaque } from '../../ui/index.js'
import type { CtaBandBlock } from '../../types/subur-types.js'
import { mailtoHref, telHref } from '../../utilities/contactHref.js'

import type { BlockContext } from '../types.js'

export function CtaBand({ heading, settings, text }: CtaBandBlock & BlockContext) {
  const phoneHref = telHref(settings.phone)
  const emailHref = mailtoHref(settings.email)

  return (
    <section className="bg-shutter text-shutter-foreground" data-block="ctaBand" data-field="shutter">
      <div className="wrap grid gap-10 py-section lg:grid-cols-12 lg:items-center">
        <div className="lg:col-span-7">
          <h2 className="text-title">{heading}</h2>
          {text && <p className="mt-5 max-w-[48ch] text-lead">{text}</p>}
        </div>
        <Plaque className="flex flex-col gap-5 lg:col-span-5" size="lg">
          {phoneHref && (
            <a className="text-title text-tile-foreground no-underline hover:underline" href={phoneHref}>
              {settings.phone}
            </a>
          )}
          <p className="font-sans text-sm text-tile-muted-foreground">{settings.hours}</p>
          <div className="flex flex-wrap gap-3 font-sans">
            {phoneHref && (
              <Button asChild size="lg">
                <a href={phoneHref}>
                  <Phone />
                  {settings.ui.callUs}
                </a>
              </Button>
            )}
            {emailHref && (
              <Button asChild size="lg" variant="outline">
                <a href={emailHref}>
                  <Mail />
                  {settings.ui.writeUs}
                </a>
              </Button>
            )}
          </div>
        </Plaque>
      </div>
    </section>
  )
}
