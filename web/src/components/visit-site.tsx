import { ArrowSquareOutIcon } from '@phosphor-icons/react'
import { useI18n } from '@/i18n'
import { useSite } from '@/hooks/useContents'
import { siteHome } from '@/lib/links'
import { Button } from '@/components/ui/button'

/** VisitSite opens the site in a new tab, from every screen's header. */
export function VisitSite() {
  const { t } = useI18n()
  const site = useSite()
  const label = t('nav.viewSite')

  return (
    // Named in words where there is room; a phone has only the icon.
    <Button variant='outline' className='max-sm:size-9 max-sm:px-0' title={label} asChild>
      <a href={siteHome(site.data)} target='_blank' rel='noreferrer'>
        <ArrowSquareOutIcon />
        <span className='max-sm:sr-only'>{label}</span>
      </a>
    </Button>
  )
}
