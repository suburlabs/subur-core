import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../../components/ui/accordion.js'
import type { FaqBlock } from '../../types/subur-types.js'

export function Faq({ heading, intro, items }: FaqBlock) {
  // Sense títol de secció, cada pregunta seria un h3 penjat d'un h1: la
  // capçalera de l'acordió la posa Radix (`AccordionPrimitive.Header`, h3).
  // Amb `heading`, la jerarquia és h2 → h3; sense, cada pregunta puja a h2
  // (mateixa tècnica que `FeatureList`, vegeu `accordion.tsx`).
  return (
    <section className="wrap py-section" data-block="faq">
      {(heading || intro) && (
        <div className="mb-10 grid gap-6 lg:grid-cols-12 lg:items-end">
          {heading && <h2 className="text-title lg:col-span-6">{heading}</h2>}
          {intro && <p className="text-lead text-muted-foreground lg:col-span-5 lg:col-start-8">{intro}</p>}
        </div>
      )}
      <Accordion className="max-w-3xl" collapsible type="single">
        {items.map((item, index) => (
          <AccordionItem key={item.id ?? index} value={item.id ?? String(index)}>
            <AccordionTrigger className="text-subtitle" headingLevel={heading ? 3 : 2}>
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="whitespace-pre-line text-body">{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
