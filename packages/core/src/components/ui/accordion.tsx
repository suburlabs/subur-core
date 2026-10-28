"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"
import { Accordion as AccordionPrimitive } from "radix-ui"

import { cn } from "../../utilities/ui.js"

function Accordion({
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  return <AccordionPrimitive.Root data-slot="accordion" {...props} />
}

function AccordionItem({
  className,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn("border-b last:border-b-0", className)}
      {...props}
    />
  )
}

function AccordionTrigger({
  className,
  children,
  headingLevel = 3,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger> & {
  // El nivell de capçalera que emet `AccordionPrimitive.Header` (Radix el
  // fixa a h3): quan un bloc no té el seu propi h2 de grup, cada ítem ha de
  // pujar a h2 perquè l'ordre de capçaleres no salti (mateixa tècnica que
  // `FeatureList`).
  headingLevel?: 2 | 3
}) {
  const trigger = (
    <AccordionPrimitive.Trigger
      data-slot="accordion-trigger"
      className={cn(
        "flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ring hover:underline disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="pointer-events-none size-4 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  )

  if (headingLevel === 2) {
    return (
      <AccordionPrimitive.Header asChild>
        <h2 className="flex">{trigger}</h2>
      </AccordionPrimitive.Header>
    )
  }

  return <AccordionPrimitive.Header className="flex">{trigger}</AccordionPrimitive.Header>
}

function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      data-slot="accordion-content"
      className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
      {...props}
    >
      <div className={cn("pt-0 pb-4", className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
