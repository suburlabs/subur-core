'use client'

import { ThemeProvider as NextThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'

// El proveïdor injecta un script en línia per fixar el tema abans del primer
// pintat. Només ha de ser executable a l'HTML del servidor: quan React el torna
// a crear al client no s'executaria igualment, i n'avisa (mateix patró que
// `InlineScript`).
const scriptProps = { type: typeof window === 'undefined' ? 'text/javascript' : 'text/plain' }

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      disableTransitionOnChange
      enableSystem
      scriptProps={scriptProps}
    >
      {children}
    </NextThemeProvider>
  )
}
