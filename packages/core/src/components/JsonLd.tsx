import type { Graph } from 'schema-dts'

/** `<` s'escapa perquè un text dels ajustos no pugui tancar l'script. */
export function JsonLd({ graph }: { graph: Graph }) {
  return (
    <script
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph).replace(/</g, '\\u003c') }}
      type="application/ld+json"
    />
  )
}
