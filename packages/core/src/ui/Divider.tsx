import { cn } from '../utilities/ui.js'

type Props = {
  className?: string
  density?: 'loose' | 'tight'
  tone?: 'default' | 'inverse'
}

export function Divider({ className, density = 'loose', tone = 'default' }: Props) {
  return (
    <div aria-hidden="true" className={cn('slat-rule', className)} data-density={density} data-tone={tone} />
  )
}
