import Image from 'next/image'

import { siteConfig } from 'subur-site-config'
import { cn } from '../../utilities/ui.js'

export function SiteLogo({ className }: { className?: string }) {
  const { logo, logoSize } = siteConfig.assets

  return (
    <Image
      alt={siteConfig.name}
      className={cn('h-10 w-auto lg:h-12', className)}
      height={logoSize.height}
      priority
      sizes="(min-width: 64rem) 200px, 160px"
      src={logo}
      unoptimized
      width={logoSize.width}
    />
  )
}
