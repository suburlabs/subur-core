'use client'

import { Monitor, MoonStar, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useLayoutEffect, useState } from 'react'

import { Button } from '../ui/button.js'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu.js'

export type ThemeLabels = {
  dark: string
  label: string
  light: string
  system: string
}

export function ThemeToggle({ labels }: { labels: ThemeLabels }) {
  const { resolvedTheme, setTheme, theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  // Mantiene una etiqueta meta "theme-color" propia sincronizada cuando el usuario elige
  // tema explícito (light/dark). Cuando vuelve a "system", la elimina para que gobiernen
  // las etiquetas media-scoped del layout. Usa requestAnimationFrame para leer estilos
  // después de que next-themes haya aplicado la clase al html.
  useEffect(() => {
    if (!mounted || typeof document === 'undefined') return

    const handle = requestAnimationFrame(() => {
      try {
        if (theme === 'light' || theme === 'dark') {
          // Read computed background from body (where globals.css sets it)
          const bgColor = getComputedStyle(document.body).backgroundColor
          if (!bgColor) return

          // Find or create our dedicated tag
          let metaTag = document.head.querySelector('meta[name="theme-color"][data-theme-sync]')
          if (!metaTag) {
            metaTag = document.createElement('meta')
            metaTag.setAttribute('name', 'theme-color')
            metaTag.setAttribute('data-theme-sync', '')
            // Insert BEFORE the first media-scoped theme-color tag from layout
            const layoutTag = document.head.querySelector('meta[name="theme-color"]:not([data-theme-sync])')
            if (layoutTag) {
              document.head.insertBefore(metaTag, layoutTag)
            } else {
              document.head.appendChild(metaTag)
            }
          }
          metaTag.setAttribute('content', bgColor)
        } else if (theme === 'system') {
          // Remove our tag when system is selected, let layout's media-scoped tags govern
          const metaTag = document.head.querySelector('meta[name="theme-color"][data-theme-sync]')
          if (metaTag) {
            metaTag.remove()
          }
        }
      } catch (_error) {
        // Ignorar errores de acceso al DOM
      }
    })

    return () => cancelAnimationFrame(handle)
  }, [mounted, theme])

  const current = mounted && resolvedTheme === 'dark' ? labels.dark : labels.light
  const options = [
    { icon: Sun, label: labels.light, value: 'light' },
    { icon: MoonStar, label: labels.dark, value: 'dark' },
    { icon: Monitor, label: labels.system, value: 'system' },
  ] as const

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* El nom accessible ha d'incloure el text visible («Oscuro», «Claro»…):
            un `aria-label` que només digués «Tema» el substituiria sencer i
            violaria «Label in Name» (regla `label-content-name-mismatch`). */}
        <Button aria-label={`${labels.label}: ${current}`} variant="secondary">
          {mounted && resolvedTheme === 'dark' ? <MoonStar /> : <Sun />}
          <span suppressHydrationWarning>{current}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {options.map((option) => (
          <DropdownMenuItem
            className="gap-2 font-sans"
            data-active={mounted && theme === option.value}
            key={option.value}
            onSelect={() => setTheme(option.value)}
          >
            <option.icon aria-hidden="true" className="size-4" />
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
