import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * InputGroup is an input with something fixed beside its text: a mark of
 * what it holds at its start, in a tinted block, or a unit at its end. The
 * group draws the field, so focus and a problem ring the whole of it.
 */
function InputGroup({
  start,
  end,
  className,
  ...props
}: React.ComponentProps<'input'> & {
  start?: React.ReactNode
  end?: React.ReactNode
}) {
  return (
    <div
      data-slot='input-group'
      className={cn(
        'field-surface flex h-10 w-full min-w-0 items-center overflow-hidden rounded-md hover:border-input-hover',
        'focus-within:border-primary focus-within:ring-[3px] focus-within:ring-field-ring',
        'has-aria-invalid:border-destructive has-aria-invalid:ring-[3px] has-aria-invalid:ring-destructive/15',
        'has-disabled:cursor-not-allowed has-disabled:opacity-50',
        className
      )}
    >
      {start && (
        <span className='flex h-full shrink-0 items-center gap-1.5 border-e bg-muted px-3 text-sm text-muted-foreground [&_svg]:size-4'>
          {start}
        </span>
      )}
      <input
        data-slot='input'
        // A unit beside a number says what it counts; the browser's arrows
        // would only crowd it.
        className='h-full min-w-0 flex-1 [appearance:textfield] bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground/70 disabled:cursor-not-allowed md:text-sm [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
        {...props}
      />
      {end && <span className='shrink-0 pe-3 text-sm text-muted-foreground'>{end}</span>}
    </div>
  )
}

export { InputGroup }
