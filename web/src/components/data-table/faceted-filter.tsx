import * as React from 'react'
import { CaretDownIcon, CheckIcon } from '@phosphor-icons/react'
import { type Column } from '@tanstack/react-table'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

type DataTableFacetedFilterProps<TData, TValue> = {
  column?: Column<TData, TValue>
  title?: string
  options: {
    label: string
    value: string
    icon?: React.ComponentType<{ className?: string }>
    // Kite: how many rows carry it, when the rows live on a server.
    count?: number
    // Kite: colors the icon and label, as in the column's cells.
    className?: string
  }[]
}

export function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  options,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const { t } = useI18n()
  const facets = column?.getFacetedUniqueValues()
  const selectedValues = new Set(column?.getFilterValue() as string[])

  return (
    <Popover>
      <PopoverTrigger asChild>
        {/* Kite: drawn as the list's chips, a well at rest and dark once
            it narrows the list, naming what it narrows to. */}
        <button
          type='button'
          className={cn(
            'inline-flex h-8 max-w-64 items-center gap-1.5 rounded-lg px-3 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
            selectedValues.size > 0
              ? 'bg-foreground font-medium text-background'
              : 'bg-muted text-foreground/80 hover:bg-accent'
          )}
        >
          {title}
          {selectedValues.size > 0 && (
            <span className='min-w-0 truncate font-normal opacity-80'>
              {selectedValues.size > 2
                ? t('list.selected', { count: selectedValues.size })
                : options
                    .filter((option) => selectedValues.has(option.value))
                    .map((option) => option.label)
                    .join(t('form.listJoin'))}
            </span>
          )}
          <CaretDownIcon className='size-3.5 shrink-0 opacity-60' />
        </button>
      </PopoverTrigger>
      <PopoverContent className='w-50 p-0' align='start'>
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>{t('palette.empty')}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      if (isSelected) {
                        selectedValues.delete(option.value)
                      } else {
                        selectedValues.add(option.value)
                      }
                      const filterValues = Array.from(selectedValues)
                      column?.setFilterValue(
                        filterValues.length ? filterValues : undefined
                      )
                    }}
                  >
                    <div
                      className={cn(
                        'flex size-4 items-center justify-center rounded-sm border border-primary',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible'
                      )}
                    >
                      <CheckIcon className={cn('h-4 w-4 text-background')} />
                    </div>
                    {option.icon && (
                      <option.icon
                        className={cn('size-4 text-muted-foreground', option.className)}
                      />
                    )}
                    <span className={option.className}>{option.label}</span>
                    {(option.count ?? facets?.get(option.value)) ? (
                      <span className='ms-auto flex h-4 min-w-4 items-center justify-center font-mono text-xs'>
                        {option.count ?? facets?.get(option.value)}
                      </span>
                    ) : null}
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selectedValues.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => column?.setFilterValue(undefined)}
                    className='justify-center text-center'
                  >
                    {t('list.clearFilter')}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
