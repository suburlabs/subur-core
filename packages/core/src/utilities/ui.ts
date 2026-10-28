/**
 * Utility functions for UI components automatically added by ShadCN and used in a few of our frontend components and blocks.
 *
 * Other functions may be exported from here in the future or by installing other shadcn components.
 */

import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// The theme (src/site/theme.css) defines custom `text-*` font-size utilities
// (hero, display, title, statement, subtitle, lead, body). Without this,
// tailwind-merge falls back to treating unknown `text-{word}` classes as
// text-color utilities, so a size class like `text-subtitle` gets dropped
// whenever it's merged alongside a real text-color class like
// `text-primary-foreground`. Registering them under the `font-size` class
// group keeps them independent from `text-color` while still letting two
// font-size utilities conflict with each other as expected.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['hero', 'display', 'title', 'statement', 'subtitle', 'lead', 'body'] },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
