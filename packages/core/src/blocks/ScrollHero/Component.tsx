import Image from 'next/image'

import { CMSLink } from '../../components/Link/index.js'
import { siteConfig } from 'subur-site-config'
import { Plaque } from '../../ui/index.js'
import type { ScrollHeroBlock } from '../../types/subur-types.js'
import { getMediaUrl } from '../../utilities/getMediaUrl.js'
import { cn } from '../../utilities/ui.js'

import type { BlockContext } from '../types.js'
import { ScrollHeroFilm } from './Film.client.js'

const heroImages = siteConfig.assets.heroFilm.posters

/**
 * Sense JS, quatre seccions editorials ordinàries, cadascuna amb la seva
 * fotografia i el seu rètol de rajola: res tapa la fotografia i es
 * travessen amb scroll normal (`data-js` és qui distingeix els dos camins
 * a primitives.css). Amb JS, l'escenari es fixa des del primer frame: les
 * mateixes quatre fotografies en són els fotogrames de repòs i el film hi
 * entra a sobre com a millora progressiva — vegeu `ScrollHeroFilm`. La
 * secció 0 porta l'`h1` i els CTA de contacte, ben amunt de la pàgina;
 * l'última secció repeteix el mateix parell de CTA, perquè contactar sigui
 * sempre a un pas.
 */
export function ScrollHero({
  ariaLabel,
  beats,
  locale,
  primaryCta,
  secondaryCta,
  settings,
}: ScrollHeroBlock & BlockContext) {
  return (
    <ScrollHeroFilm count={beats.length} heroFilm={siteConfig.assets.heroFilm}>
      <section aria-label={ariaLabel} data-block="scrollHero">
        <div data-hero-stage>
          <video
            aria-hidden="true"
            className="hero-film"
            data-hero-film
            disablePictureInPicture
            muted
            playsInline
            poster={heroImages[0]?.src}
            preload="none"
          />

          {beats.map((beat, index) => {
            const isFirst = index === 0
            const isLast = index === beats.length - 1
            const Heading = isFirst ? 'h1' : 'h2'
            // La foto de l'escena ve del CMS (camp «Foto» de cada escena): és
            // la capa de fons des de la primera pintada, mentre es carrega el
            // film i sempre que no es pot reproduir. Si l'escena no en té, es
            // fa servir el fotograma del film de `public/site/hero/`.
            const frame = heroImages[index] ?? heroImages[heroImages.length - 1]
            const photo = beat.image && typeof beat.image === 'object' && beat.image.url ? beat.image : null
            const image = photo
              ? {
                  height: photo.height ?? frame?.height ?? 720,
                  src: getMediaUrl(photo.url, photo.updatedAt),
                  width: photo.width ?? frame?.width ?? 1280,
                }
              : frame

            return (
              <div
                className={cn('wrap', isFirst ? 'pt-[clamp(2.5rem,2rem+3vw,5rem)] pb-section' : 'py-section')}
                data-active={index === 0}
                data-beat={index}
                key={index}
              >
                <Plaque className="w-fit max-w-full" size="lg">
                  <Heading className="max-w-[18ch] text-hero">{beat.heading}</Heading>
                  {beat.body && <p className="mt-4 max-w-[32ch] font-sans text-lead">{beat.body}</p>}
                  {(isFirst || isLast) && (
                    <div className="mt-6 flex flex-wrap gap-3">
                      <CMSLink {...primaryCta} appearance="default" locale={locale} size="lg" />
                      <CMSLink {...secondaryCta} appearance="outline" locale={locale} size="lg" />
                    </div>
                  )}
                </Plaque>

                {image && (
                  <div className="relative mt-8 aspect-[16/9] overflow-hidden bg-surface-shade sm:mt-10" data-beat-photo>
                    <Image
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      height={image.height}
                      // Només la primera foto és la que es pinta d'entrada (les
                      // altres tres comencen a opacitat 0, apilades a la mateixa
                      // caixa): marcar-les totes `priority` (fetchPriority: high)
                      // les feia competir per l'ample de banda amb el candidat
                      // real a LCP i enfonsava el rendiment a mòbil. Sense
                      // `priority` continuen carregant-se de seguida perquè el
                      // seu requadre ja és dins del viewport inicial — només
                      // baixa la seva prioritat de xarxa.
                      loading={isFirst ? undefined : 'eager'}
                      priority={isFirst}
                      // A JS —el mode real, escenari fixat— la foto és a tota
                      // amplada de viewport, no dins de `.wrap`: `data-beat-photo`
                      // travessa `[data-beat]` amb `position: absolute` fins al
                      // contenidor `[data-hero-stage]` (nota F1 a primitives.css).
                      // La xifra anterior copiava l'amplada contenidora del
                      // PageHero i li demanava a Next una imatge més petita del
                      // que realment es mostrava; el navegador l'ampliava
                      // lleugerament i la penalització per mida intrínseca de
                      // l'algorisme de LCP li restava punts davant del vídeo (a
                      // la seva resolució nativa, sense penalitzar) — vegeu Tasca 8.
                      sizes="100vw"
                      src={image.src}
                      width={image.width}
                    />
                  </div>
                )}
              </div>
            )
          })}

          <ol aria-hidden="true" className="hero-rail">
            {beats.map((beat, index) => (
              <li data-active={index === 0} data-hero-rail-item={index} key={index}>
                <span className="hero-rail__mark" />
                {beat.label}
              </li>
            ))}
            {/* Moment autoritzat de càrrega, tot dins del carril opac (vegeu
                Film.client.tsx i primitives.css): el filet superior del
                carril passa a ombra freda i el blau l'omple a mesura que
                arriba el film (`data-hero-progress-bar`), i al lloc de
                l'última etiqueta una frase en la mateixa veu que les escenes
                diu què es carrega i quant en falta. El carril és
                `aria-hidden`: per a l'arbre d'accessibilitat l'estat el
                porta `aria-busy` a la secció. */}
            <li className="hero-rail__loader">
              <span className="hero-rail__progress" data-hero-progress-bar />
              {settings.ui.heroFilmLoading}
              <span className="hero-rail__percent" data-hero-progress-label>
                0%
              </span>
            </li>
          </ol>
        </div>
      </section>
    </ScrollHeroFilm>
  )
}
