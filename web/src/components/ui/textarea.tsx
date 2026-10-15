import * as React from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot='textarea'
      className={cn(
        'field-surface flex field-sizing-content min-h-20 w-full rounded-md px-3 py-2.5 text-base leading-relaxed outline-none placeholder:text-muted-foreground/70 hover:border-input-hover focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-field-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destructive/15 md:text-sm',
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
