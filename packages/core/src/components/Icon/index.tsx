import {
  Blinds,
  Car,
  ClipboardCheck,
  Clock,
  DoorOpen,
  Droplets,
  House,
  KeyRound,
  type LucideIcon,
  Mail,
  PackageSearch,
  Phone,
  Plug,
  SearchCheck,
  ShieldCheck,
  Shirt,
  Sofa,
  Sparkles,
  Sprout,
  Trees,
  Wrench,
} from 'lucide-react'

import type { IconName } from '../../fields/icon.js'

export const iconMap: Record<IconName, LucideIcon> = {
  blinds: Blinds,
  car: Car,
  'clipboard-check': ClipboardCheck,
  clock: Clock,
  'door-open': DoorOpen,
  droplets: Droplets,
  house: House,
  'key-round': KeyRound,
  mail: Mail,
  'package-search': PackageSearch,
  phone: Phone,
  plug: Plug,
  'search-check': SearchCheck,
  'shield-check': ShieldCheck,
  shirt: Shirt,
  sofa: Sofa,
  sparkles: Sparkles,
  sprout: Sprout,
  trees: Trees,
  wrench: Wrench,
}

type Props = {
  className?: string
  name?: string | null
}

export function Icon({ className, name }: Props) {
  if (!name || !(name in iconMap)) return null
  const Component = iconMap[name as IconName]
  return <Component aria-hidden="true" className={className} />
}
