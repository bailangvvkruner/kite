import { Link } from '@tanstack/react-router'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { KiteMark } from '@/components/KiteMark'

/**
 * StudioBrand heads the rail with Kite's mark and name and leads back to the
 * dashboard. It takes the place of shadcn-admin's team switcher: a studio has
 * one site, so there is nothing to switch to. The site's name is left to the
 * dashboard and the version to the footer, so the head stays one short line.
 */
export function StudioBrand() {
  const { setOpenMobile } = useSidebar()

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size='lg' tooltip='Kite' asChild>
          <Link to='/' onClick={() => setOpenMobile(false)}>
            {/* Wrapped, as the button would size a bare svg down to 16px. The
                mark's own margin is pulled in to line up with the rail's icons. */}
            <span className='-ms-1.5 flex shrink-0 group-data-[collapsible=icon]:ms-0'>
              <KiteMark className='size-10 group-data-[collapsible=icon]:size-8' />
            </span>
            <span className='truncate text-base font-semibold'>Kite</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
