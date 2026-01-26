import { LayoutDashboard, Users, UsersRound, Activity, Settings, ClipboardList, ArrowLeftRight, Menu, Target } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
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
import { useParams } from 'react-router-dom';

export function AppSidebar() {
  const { state, isMobile } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const isLeagueManager = useAuthStore(state => state.isLeagueManager());
  const { leagueId } = useParams<{ leagueId: string }>();



  // On mobile, always show labels (no collapse mode)
  const showLabels = isMobile || !collapsed;

  const navItems = leagueId ? [
    { title: 'Home', url: `/${leagueId}`, icon: LayoutDashboard },
    { title: 'Rosters', url: `/${leagueId}/roster`, icon: Users },
    { title: 'Players', url: `/${leagueId}/players`, icon: UsersRound },
    { title: 'Trades', url: `/${leagueId}/trades`, icon: ArrowLeftRight },
    { title: 'Activity', url: `/${leagueId}/activity`, icon: Activity },
    { title: 'Draft', url: `/${leagueId}/draft`, icon: ClipboardList },
    ...(isLeagueManager ? [
      { title: 'Scoring', url: `/${leagueId}/scoring`, icon: Target },
      { title: 'Admin', url: `/${leagueId}/admin`, icon: Settings },
    ] : []),
  ] : [
    { title: 'Leagues', url: '/leagues', icon: LayoutDashboard },
  ];


  const isActive = (path: string) => {
    return location.pathname === path || (leagueId && path === `/${leagueId}` && location.pathname.startsWith(`/${leagueId}/team/`));
  };


  return (
    <Sidebar
      className={cn(
        "border-r border-border bg-card transition-all duration-300",
        collapsed && !isMobile ? "w-14" : "w-56"
      )}
      collapsible="icon"
    >
      <div className="flex items-center h-14 px-3 border-b border-border">
        <SidebarTrigger className="h-8 w-8" />
        {showLabels && (
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
                    tooltip={!showLabels ? item.title : undefined}
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
                      {showLabels && <span className="truncate">{item.title}</span>}
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
