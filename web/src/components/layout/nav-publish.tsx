import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { GitCommitHorizontal, TriangleAlert } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useWritable } from '@/hooks/useContents'
import { canPublish, useDelivery, usePublish } from '@/hooks/usePublish'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Spinner } from '@/components/ui/spinner'
import { checkedAgo } from '@/components/publish/Delivery'
import { PublishDialog } from '@/components/publish/PublishDialog'

/**
 * NavPublish keeps what waits to go out in sight from every page, at the
 * rail's foot: the changes not yet published, or the commits not yet pushed,
 * with the way to send them, or a publish that failed. With nothing waiting
 * it shows nothing.
 */
export function NavPublish() {
  const { t, locale } = useI18n()
  const { state, isMobile, setOpenMobile } = useSidebar()
  const navigate = useNavigate()
  const delivery = useDelivery()
  const writable = useWritable()
  const publish = usePublish([])
  const [open, setOpen] = useState(false)

  const d = delivery.data
  const dirty = d?.dirty ?? []
  const ahead = d?.ahead ?? 0
  const failed = d?.last_error ? 'error' : d?.deployed === 'failed' ? 'failed' : null
  if (!d || !writable || !canPublish(d) || (!dirty.length && !ahead && !failed)) return null

  // What waits outranks what failed: publishing it again is the way on.
  const title = dirty.length
    ? t('publish.pending', { count: dirty.length })
    : ahead
      ? t('publish.toPush', { count: ahead })
      : t(failed === 'error' ? 'publish.headline.error' : 'publish.headline.failed')
  const warn = !dirty.length && !ahead
  const where = [d.branch && `${d.remote ?? 'origin'}/${d.branch}`, checkedAgo(d.checked_at, locale, t)]
    .filter(Boolean)
    .join(' · ')

  const send = () => {
    if (dirty.length) setOpen(true)
    else if (ahead) void publish.push()
    else {
      setOpenMobile(false)
      void navigate({ to: '/deploy' })
    }
  }
  const Icon = warn ? TriangleAlert : GitCommitHorizontal
  const dialog = (
    <PublishDialog
      ids={[]}
      paths={dirty}
      open={open}
      onOpenChange={setOpen}
      onDone={() => undefined}
      title={t('publish.allTitle')}
      description={t('publish.allNote', { paths: dirty.join(', ') })}
    />
  )

  if (state === 'collapsed' && !isMobile)
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip={title} onClick={send}>
            <Icon className={warn ? 'text-destructive' : 'text-string'} />
            <span>{title}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        {dialog}
      </SidebarMenu>
    )

  return (
    <div className='rounded-xl bg-background p-3 shadow-[0_0_0_1px_rgb(23_32_54/0.05)] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.06)]'>
      <p className='flex items-center gap-2 text-sm font-semibold'>
        <Icon className={cn('size-4 shrink-0', warn ? 'text-destructive' : 'text-string')} />
        <span className='truncate'>{title}</span>
      </p>
      {where && <p className='mt-1 truncate text-xs text-muted-foreground'>{where}</p>}
      <div className='mt-3 flex gap-2'>
        {!warn && (
          <Button size='sm' className='h-8 flex-1' disabled={publish.pending} onClick={send}>
            {publish.pending && <Spinner />}
            {dirty.length ? t('publish.action') : t('publish.push')}
          </Button>
        )}
        <Button size='sm' variant='outline' className={cn('h-8', warn && 'flex-1')} asChild>
          <Link to='/deploy' onClick={() => setOpenMobile(false)}>
            {t('publish.view')}
          </Link>
        </Button>
      </div>
      {dialog}
    </div>
  )
}
