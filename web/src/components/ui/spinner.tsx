import { CircleNotchIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

// Kite: shadcn-admin writes the spinning icon inline; the studio's own
// screens use it often enough to name it.
function Spinner({ className, ...props }: React.ComponentProps<typeof CircleNotchIcon>) {
  return (
    <CircleNotchIcon
      role='status'
      aria-label='Loading'
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
