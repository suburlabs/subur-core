import { Media } from '../../components/Media/index.js'
import { Plaque } from '../../ui/index.js'
import type { StatementBlock } from '../../types/subur-types.js'

export function Statement({ image, supporting, text, variant }: StatementBlock) {
  if (variant === 'quote') {
    return (
      <section className="wrap py-section" data-block="statement">
        <Plaque as="blockquote" className="mx-auto max-w-3xl text-center" size="lg">
          <p className="text-statement">{text}</p>
          {supporting && <p className="mt-4 font-sans text-lead">{supporting}</p>}
        </Plaque>
        {image && typeof image === 'object' && (
          <div className="relative mt-12 aspect-[16/9] overflow-hidden bg-surface-shade">
            <Media
              className="absolute inset-0"
              fill
              imgClassName="object-cover"
              resource={image}
              size="(min-width: 1280px) 1184px, (min-width: 1200px) calc(100vw - 6rem), (min-width: 400px) 92vw, calc(100vw - 2rem)"
            />
          </div>
        )}
      </section>
    )
  }

  return (
    <section className="wrap py-section" data-block="statement">
      <div className="grid gap-8 lg:grid-cols-12">
        <p className="font-display text-statement lg:col-span-8">{text}</p>
        {supporting && (
          <p className="text-lead text-muted-foreground lg:col-span-4 lg:self-end">{supporting}</p>
        )}
      </div>
      {image && typeof image === 'object' && (
        <div className="relative mt-12 aspect-[16/9] overflow-hidden bg-surface-shade">
          <Media
            className="absolute inset-0"
            fill
            imgClassName="object-cover"
            resource={image}
            size="(min-width: 1280px) 1184px, (min-width: 1200px) calc(100vw - 6rem), (min-width: 400px) 92vw, calc(100vw - 2rem)"
          />
        </div>
      )}
    </section>
  )
}
