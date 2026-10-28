import type { StaticImageData } from 'next/image'
import type { ElementType } from 'react'

import type { Media as MediaType } from '../../types/subur-types.js'

export interface Props {
  alt?: string
  className?: string
  fill?: boolean // for NextImage only
  htmlElement?: ElementType | null
  pictureClassName?: string
  imgClassName?: string
  onClick?: () => void
  loading?: 'lazy' | 'eager' // for NextImage only
  priority?: boolean // for NextImage only
  resource?: MediaType | string | number | null // for CMS media
  size?: string // for NextImage only
  src?: StaticImageData // for static media
  videoClassName?: string
}
