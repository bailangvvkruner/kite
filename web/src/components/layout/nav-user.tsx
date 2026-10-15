import { Link, useLocation } from '@tanstack/react-router'
import { SignOutIcon } from '@phosphor-icons/react'
import { useI18n } from '@/i18n'
import useDialogState from '@/hooks/use-dialog-state'
import { Button } from '@/components/ui/button'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SignOutDialog } from '@/components/sign-out-dialog'
import { cn } from '@/lib/utils'
import { UserAvatar, useAccount } from './account'

/**
 * NavUser is the person at the foot of the sidebar. Their picture and name
 * lead to their profile, and the one button at the card's end is the way
 * out; where nobody signs in there is no way out, and the button says so.
 */
export function NavUser() {
  const { t } = useI18n()
  const { state, isMobile, setOpenMobile } = useSidebar()
  const [open, setOpen] = useDialogState()
  const account = useAccount()
  const onProfile = useLocation({ select: (location) => location.pathname }) === '/settings/account'
  const folded = state === 'collapsed' && !isMobile
  const signOutLabel = account.user ? t('session.signOut') : t('session.noSignOut')

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size='lg'
            asChild
            isActive={onProfile}
            tooltip={t('session.profile')}
            // The way out sits on the card, so the card stays lit while the
            // pointer is on it.
            className={cn(!folded && 'pe-11', !onProfile && 'group-hover/menu-item:bg-sidebar-accent')}
          >
            <Link to='/settings/account' onClick={() => setOpenMobile(false)}>
              <UserAvatar />
              <div className='grid min-w-0 flex-1 text-start text-sm leading-tight'>
                {account.name ? (
                  <span className='truncate font-medium'>{account.name}</span>
                ) : (
                  <Skeleton className='h-4 w-20' />
                )}
                {account.detail && (
                  <span className='truncate text-xs text-muted-foreground'>{account.detail}</span>
                )}
              </div>
            </Link>
          </SidebarMenuButton>
          {!folded && (
            <Tooltip>
              {/* A disabled button takes no pointer, so its hint hangs on a wrapper. */}
              <TooltipTrigger asChild>
                <span
                  tabIndex={account.user ? undefined : 0}
                  className='absolute inset-e-2 top-1/2 -translate-y-1/2 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'
                >
                  <Button
                    variant='ghost'
                    size='icon'
                    className='size-8 text-muted-foreground hover:bg-muted hover:text-foreground'
                    aria-label={signOutLabel}
                    disabled={!account.user}
                    onClick={() => setOpen(true)}
                  >
                    <SignOutIcon />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side='top' className='max-w-56'>
                {signOutLabel}
              </TooltipContent>
            </Tooltip>
          )}
        </SidebarMenuItem>
        {folded && (
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={signOutLabel}
              aria-disabled={!account.user}
              className='aria-disabled:opacity-50'
              onClick={() => account.user && setOpen(true)}
            >
              <SignOutIcon />
              <span>{t('session.signOut')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
