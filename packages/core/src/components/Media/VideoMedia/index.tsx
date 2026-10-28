'use client'

import { cn } from '../../../utilities/ui.js'
import React from 'react'

import type { Props as MediaProps } from '../types.js'

import { getMediaUrl } from '../../../utilities/getMediaUrl.js'

export const VideoMedia: React.FC<MediaProps> = (props) => {
  const { onClick, resource, videoClassName } = props

  if (!resource || typeof resource !== 'object' || !resource.url) return null

  return (
    <video
      autoPlay
      className={cn(videoClassName)}
      controls={false}
      loop
      muted
      onClick={onClick}
      playsInline
    >
      <source src={getMediaUrl(resource.url, resource.updatedAt)} />
    </video>
  )
}
