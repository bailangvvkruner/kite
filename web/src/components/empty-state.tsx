import { useState } from 'react'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

/**
 * EmptyState invites the first of something: what would go here, and the
 * ways to add it. A file dropped on it goes to onDrop, where there is one.
 */
export function EmptyState({
  icon: Icon,
  title,
  note,
  onDrop,
  compact,
  className,
  children,
}: {
  icon: PhosphorIcon
  title: React.ReactNode
  note?: React.ReactNode
  onDrop?: (file: File) => void
  /** compact lays it out as one row, for a part of a page rather than all of it. */
  compact?: boolean
  className?: string
  /** children are the actions, centered under the note. */
  children?: React.ReactNode
}) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={
        onDrop &&
        ((event) => {
          event.preventDefault()
          setOver(true)
        })
      }
      onDragLeave={onDrop && (() => setOver(false))}
      onDrop={
        onDrop &&
        ((event) => {
          event.preventDefault()
          setOver(false)
          const file = event.dataTransfer.files[0]
          if (file) onDrop(file)
        })
      }
      className={cn(
        'flex flex-col items-center gap-4 rounded-xl border border-dashed bg-muted/30 px-6 py-12 text-center transition-colors',
        compact && 'px-5 py-5 sm:flex-row sm:text-start',
        over && 'border-primary bg-primary/5',
        className
      )}
    >
      <Icon weight='duotone' className={cn('shrink-0 text-primary', compact ? 'size-8' : 'size-10')} />
      <div className={cn('grid gap-1', compact ? 'min-w-0 flex-1 justify-items-center sm:justify-items-start' : 'justify-items-center')}>
        <p className='font-semibold'>{title}</p>
        {note && <p className='max-w-md text-sm text-muted-foreground'>{note}</p>}
      </div>
      {children && (
        <div className={cn('flex flex-wrap justify-center gap-2', compact && 'sm:shrink-0')}>{children}</div>
      )}
    </div>
  )
}
