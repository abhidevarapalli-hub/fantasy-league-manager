import { LayoutDashboard, Users, UsersRound, Activity, Settings, ClipboardList, ArrowLeftRight, Menu } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { isLeagueManager } = useAuth();

  const navItems = [
    { title: 'Home', url: '/', icon: LayoutDashboard },
    { title: 'Rosters', url: '/roster', icon: Users },
    { title: 'Players', url: '/players', icon: UsersRound },
    { title: 'Trades', url: '/trades', icon: ArrowLeftRight },
    { title: 'Activity', url: '/activity', icon: Activity },
    { title: 'Draft', url: '/draft', icon: ClipboardList },
    ...(isLeagueManager ? [{ title: 'Admin', url: '/admin', icon: Settings }] : []),
  ];

  const isActive = (path: string) => {
    return location.pathname === path || (path === '/' && location.pathname.startsWith('/team/'));
  };

  return (
    <Sidebar
      className={cn(
        "border-r border-border bg-card transition-all duration-300",
        collapsed ? "w-14" : "w-56"
      )}
      collapsible="icon"
    >
      <div className="flex items-center h-14 px-3 border-b border-border">
        <SidebarTrigger className="h-8 w-8" />
        {!collapsed && (
          <span className="ml-2 font-semibold text-sm text-foreground truncate">Menu</span>
        )}
      </div>

      <SidebarContent className="py-2">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.url)}
                    tooltip={collapsed ? item.title : undefined}
                  >
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                        "hover:bg-muted/50"
                      )}
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span className="truncate">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
