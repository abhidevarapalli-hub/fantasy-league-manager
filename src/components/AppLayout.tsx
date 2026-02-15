import { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { UserMenu } from '@/components/UserMenu';


interface AppLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
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
            <div className="flex items-center justify-between px-4 h-14">
              <div className="flex items-center gap-3 min-w-0">
                {leagueId && (
                  <SidebarTrigger className="h-8 w-8 flex-shrink-0" />
                )}
                <div className="min-w-0">

                  <h1 className="text-lg font-bold text-foreground truncate">{title}</h1>
                  {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {headerActions}
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
