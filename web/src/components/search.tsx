import { SearchIcon } from 'lucide-react'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { useSearch } from '@/context/search-provider'
import { Button } from './ui/button'

export function Search({
  className = '',
  placeholder,
  ...props
}: React.ComponentProps<'button'> & { placeholder?: string }) {
  const { t } = useI18n()
  const { setOpen } = useSearch()
  return (
    <Button
      {...props}
      variant='outline'
      className={cn(
        // Kite: a tinted well rather than an outlined box, as on the sheet.
        'group relative h-9 w-full flex-1 justify-start rounded-[10px] border-transparent bg-muted text-sm font-normal text-muted-foreground shadow-none hover:bg-muted/70 hover:text-muted-foreground sm:w-48 sm:pe-12 md:flex-none lg:w-64 xl:w-72 dark:border-transparent dark:bg-muted dark:hover:bg-muted/70',
        className
      )}
      aria-keyshortcuts='Meta+K Control+K'
      onClick={() => setOpen(true)}
    >
      <SearchIcon
        aria-hidden='true'
        className='absolute inset-s-3 top-1/2 -translate-y-1/2'
        size={16}
      />
      <span className='ms-5'>{placeholder ?? t('nav.search')}</span>
      <kbd className='pointer-events-none absolute inset-e-2 top-2 hidden h-5 items-center gap-1 rounded-[5px] border bg-background px-1.5 font-mono text-[10px] font-medium opacity-100 select-none sm:flex'>
        <span className='text-xs'>⌘</span>K
      </kbd>
    </Button>
  )
}
