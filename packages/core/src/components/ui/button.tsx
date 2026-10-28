import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "../../utilities/ui.js"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm font-sans text-[0.9375rem] font-semibold transition-colors duration-200 ease-(--ease-shutter) outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-ring aria-invalid:outline-destructive",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-brand-strong',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline:
          'border-[1.5px] border-primary bg-transparent text-primary hover:bg-surface-shade',
        secondary: 'bg-card text-primary hover:bg-surface-shade',
        ghost: 'text-primary hover:bg-surface-shade',
        link: 'text-primary underline decoration-1 underline-offset-4 hover:decoration-2',
      },
      size: {
        default: 'h-11 px-5 has-[>svg]:px-4',
        sm: 'h-10 px-4 has-[>svg]:px-3',
        lg: 'h-12 px-6 text-base has-[>svg]:px-5',
        icon: 'size-11',
        'icon-sm': 'size-10',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
