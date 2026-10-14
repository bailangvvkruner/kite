import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
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
  className,
  children,
}: {
  icon: LucideIcon
  title: React.ReactNode
  note?: React.ReactNode
  onDrop?: (file: File) => void
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
        over && 'border-primary bg-primary/5',
        className
      )}
    >
      <span className='flex size-12 items-center justify-center rounded-2xl bg-background text-muted-foreground shadow-[0_0_0_1px_var(--border)] [&_svg]:size-5'>
        <Icon />
      </span>
      <div className='grid justify-items-center gap-1'>
        <p className='font-semibold'>{title}</p>
        {note && <p className='max-w-md text-sm text-muted-foreground'>{note}</p>}
      </div>
      {children && <div className='flex flex-wrap justify-center gap-2'>{children}</div>}
    </div>
  )
}
