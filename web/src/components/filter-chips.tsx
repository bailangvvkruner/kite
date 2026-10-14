import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export interface FilterChip<T extends string> {
  value: T
  label: string
  count?: number
  icon?: PhosphorIcon
}

/**
 * FilterChips narrow a page to one of a few sets, as chips with each set's
 * size: the chosen one dark on the sheet, the rest tinted wells.
 */
export function FilterChips<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  /** label names the group for a screen reader. */
  label: string
  value: T
  options: FilterChip<T>[]
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div role='group' aria-label={label} className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map(({ value: each, label, count, icon: Icon }) => {
        const on = each === value
        return (
          <button
            key={each}
            type='button'
            aria-pressed={on}
            onClick={() => onChange(each)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4',
              on
                ? 'bg-foreground font-medium text-background'
                : 'bg-muted text-foreground/80 hover:bg-accent'
            )}
          >
            {Icon && <Icon />}
            {label}
            {count !== undefined && (
              <>
                {' '}
                <span className='tabular-nums opacity-70'>{count}</span>
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}
