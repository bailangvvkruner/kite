import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

/**
 * SectionCard is one part of a page on the sheet: a large two-tone icon in
 * the mark's blue, a title and a line on what the part is for, then its
 * body, so pages made of several parts read alike.
 */
export function SectionCard({
  icon: Icon,
  title,
  description,
  aside,
  className,
  children,
}: {
  icon?: PhosphorIcon
  title: React.ReactNode
  description?: React.ReactNode
  /** aside sits at the header's end, for a status or an action. */
  aside?: React.ReactNode
  className?: string
  children?: React.ReactNode
}) {
  return (
    <section data-slot='card' className={cn('min-w-0 rounded-xl border bg-card p-5 sm:p-6', className)}>
      <header className={cn('flex items-start gap-3.5', children && 'mb-5')}>
        {Icon && <Icon weight='duotone' className='size-7 shrink-0 text-primary' />}
        <div className='min-w-0 flex-1'>
          <h3 className='leading-snug font-semibold'>{title}</h3>
          {description && <p className='mt-1 text-sm text-muted-foreground'>{description}</p>}
        </div>
        {aside && <div className='shrink-0'>{aside}</div>}
      </header>
      {children}
    </section>
  )
}
