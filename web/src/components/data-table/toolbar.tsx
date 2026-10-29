import { MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react'
import { type Table } from '@tanstack/react-table'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTableFacetedFilter } from './faceted-filter'
import { DataTableViewOptions } from './view-options'

type DataTableToolbarProps<TData> = {
  table: Table<TData>
  searchPlaceholder?: string
  searchKey?: string
  filters?: {
    columnId: string
    title: string
    options: {
      label: string
      value: string
      icon?: React.ComponentType<{ className?: string }>
      count?: number
      className?: string
    }[]
  }[]
  // Kite: controls a screen adds after the filters.
  children?: React.ReactNode
}

export function DataTableToolbar<TData>({
  table,
  searchPlaceholder,
  searchKey,
  filters = [],
  children,
}: DataTableToolbarProps<TData>) {
  const { t } = useI18n()
  const isFiltered =
    table.getState().columnFilters.length > 0 || table.getState().globalFilter

  return (
    <div className='flex items-center justify-between'>
      <div className='flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2'>
        <div className='relative w-full sm:w-64'>
          <MagnifyingGlassIcon className='pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            type='search'
            placeholder={searchPlaceholder ?? t('list.filter')}
            aria-label={searchPlaceholder ?? t('list.filter')}
            value={
              searchKey
                ? ((table.getColumn(searchKey)?.getFilterValue() as string) ?? '')
                : (table.getState().globalFilter ?? '')
            }
            onChange={(event) =>
              searchKey
                ? table.getColumn(searchKey)?.setFilterValue(event.target.value)
                : table.setGlobalFilter(event.target.value)
            }
            className='h-8 ps-8'
          />
        </div>
        <div className='flex gap-x-2'>
          {filters.map((filter) => {
            const column = table.getColumn(filter.columnId)
            if (!column) return null
            return (
              <DataTableFacetedFilter
                key={filter.columnId}
                column={column}
                title={filter.title}
                options={filter.options}
              />
            )
          })}
        </div>
        {children}
        {isFiltered && (
          <Button
            variant='ghost'
            onClick={() => {
              table.resetColumnFilters()
              table.setGlobalFilter('')
            }}
            className='h-8 px-2 lg:px-3'
          >
            {t('list.reset')}
            <XIcon className='ms-2 h-4 w-4' />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  )
}
