import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useSidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { StudioBrand } from './studio-brand'

export function AppSidebar() {
  const { collapsible } = useLayout()
  const sidebarData = useSidebarData()
  return (
    // Kite: always inset, each page a sheet raised over the rail's canvas.
    <Sidebar collapsible={collapsible} variant='inset'>
      {/* As tall as the sheet's top bar, so the brand sits level with it. */}
      <SidebarHeader className='h-16 justify-center py-0'>
        <StudioBrand />
      </SidebarHeader>
      <SidebarContent>
        {sidebarData.navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
