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
        <SidebarMenuButton
          size='lg'
          tooltip='Kite'
          asChild
          className='gap-2.5 hover:bg-transparent active:bg-transparent group-data-[collapsible=icon]:justify-center'
        >
          <Link to='/' onClick={() => setOpenMobile(false)}>
            {/* Wrapped, as the button would size a bare svg down to 16px. The
                tight mark starts where the rail's icons do. */}
            <span className='flex shrink-0'>
              <KiteMark tight className='h-6 w-auto group-data-[collapsible=icon]:h-5' />
            </span>
            <span className='font-serif text-[21px] leading-none font-bold tracking-[0.02em] group-data-[collapsible=icon]:hidden'>
              Kite
            </span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
