import { Icon } from '../../components/Icon/index.js'
import { Plaque } from '../../ui/index.js'
import type { NoteBlock } from '../../types/subur-types.js'

export function Note({ icon, text, title }: NoteBlock) {
  return (
    <aside className="wrap py-[clamp(2rem,1.5rem+2vw,3.5rem)]" data-block="note">
      <Plaque className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center" size="lg">
        <Icon className="size-7" name={icon} />
        <p className="text-subtitle font-semibold">{title}</p>
        <p className="max-w-[60ch] font-sans text-body">{text}</p>
      </Plaque>
    </aside>
  )
}
