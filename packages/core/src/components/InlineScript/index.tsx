'use client'

/**
 * Un script en línia que corre mentre el navegador analitza l'HTML, abans del
 * primer pintat. Al servidor surt executable; quan React el torna a crear al
 * client (canvi d'idioma, que remunta el layout) surt com a `text/plain`,
 * perquè un script inserit pel DOM no s'executa i React n'avisa. Patró de la
 * guia de Next «preventing flash before hydration».
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: html }}
      suppressHydrationWarning
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
    />
  )
}
