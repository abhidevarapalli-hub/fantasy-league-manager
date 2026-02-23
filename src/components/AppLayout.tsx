import { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { UserMenu } from '@/components/UserMenu';


interface AppLayoutProps {
  children: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  headerActions?: ReactNode;
}

export function AppLayout({ children, title, subtitle, headerActions }: AppLayoutProps) {
  const { leagueId } = useParams();

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border pt-[env(safe-area-inset-top)]">
            {/* Bottom Bar - Page Content Info */}
            <div className="flex items-center justify-between px-4 py-3 min-h-[4rem]">
              <div className="min-w-0 flex-1 flex items-center gap-3">
                {leagueId && (
                  <SidebarTrigger className="h-8 w-8 flex-shrink-0 md:hidden" />
                )}
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-foreground tracking-tight mb-1">{title}</h1>
                  {subtitle && (
                    <div className="text-xs text-muted-foreground animate-in fade-in slide-in-from-top-1 duration-300">
                      {subtitle}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                {headerActions && (
                  <div className="flex items-center gap-2 flex-shrink-0 text-sm">
                    {headerActions}
                  </div>
                )}
                <UserMenu />
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
