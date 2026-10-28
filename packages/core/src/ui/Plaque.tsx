import type { ReactNode } from 'react'

import { cn } from '../utilities/ui.js'

type Props = {
  as?: 'address' | 'blockquote' | 'div' | 'p' | 'span'
  children: ReactNode
  className?: string
  size?: 'lg' | 'md' | 'sm'
}

export function Plaque({ as: Tag = 'div', children, className, size = 'md' }: Props) {
  return (
    <Tag className={cn('plaque', className)} data-size={size}>
      {children}
    </Tag>
  )
}
