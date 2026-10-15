import { useRef } from 'react'
import { ReadOnlyNote } from '@/components/read-only-note'
import { cn } from '@/lib/utils'
import { PublishBar } from './publish-bar'
import { SectionRoute, SectionsProvider, useSections, type Destination } from './sections'

type ContentSectionProps = {
  title: string
  desc: string
  children: React.JSX.Element
  // Kite: the theme gallery needs the whole column, not a form's width.
  wide?: boolean
  // Kite: writes says the section changes the site, which a server that
  // takes no changes says it will not do.
  writes?: boolean
  // Kite: what the form does with its changes, kept beside the title so
  // saving is in reach wherever the page is scrolled to.
  actions?: React.ReactNode
  // Kite: where the changes go, written where the route ends.
  end?: Destination
}

// Kite: a section heads the page, with what is waiting to be published under
// its title, since the app sidebar is the menu of the sections. A page of
// several parts lists them on a route beside the form.
export function ContentSection({ title, desc, children, wide, writes, actions, end }: ContentSectionProps) {
  return (
    <SectionsProvider>
      {/* Positioned, so the scroll area's fade ends at the column's foot,
          above the studio's footer rather than over it. */}
      <div className='relative flex min-h-0 flex-1 flex-col overflow-hidden'>
        <header className='flex flex-none flex-wrap items-end gap-x-6 gap-y-3 border-b pb-5'>
          <div className='min-w-0 flex-1'>
            <h1 className='text-2xl font-semibold tracking-tight sm:text-[1.625rem]'>{title}</h1>
            <p className='mt-1 text-sm text-muted-foreground'>{desc}</p>
          </div>
          {actions && <div className='flex flex-wrap items-center gap-2'>{actions}</div>}
        </header>
        {writes && <ReadOnlyNote className='mt-4 flex-none' />}
        <PublishBar className='mt-4 mb-0 flex-none lg:mb-0' />
        <Body wide={wide} end={end}>
          {children}
        </Body>
      </div>
    </SectionsProvider>
  )
}

function Body({ wide, end, children }: { wide?: boolean; end?: Destination; children: React.ReactNode }) {
  const scroller = useRef<HTMLDivElement>(null)
  const route = useSections().length > 1
  return (
    // The bottom padding is the fade's height, so a form's last control
    // scrolls clear of it instead of looking disabled.
    <div ref={scroller} className='faded-bottom h-full min-h-0 w-full overflow-y-auto scroll-smooth pe-4 pb-32'>
      <div
        className={cn(
          'pt-8',
          route && '@4xl/content:grid @4xl/content:grid-cols-[12.5rem_minmax(0,1fr)] @4xl/content:gap-14'
        )}
      >
        {route && <SectionRoute scroller={scroller} end={end} className='hidden @4xl/content:block' />}
        <div className={cn('@container/form -mx-1 min-w-0 px-1.5', !wide && 'max-w-3xl')}>{children}</div>
      </div>
    </div>
  )
}
