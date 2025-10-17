import { ReactNode, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { AdminSidebar } from './AdminSidebar';
import { SidebarContent } from './SidebarContent';
import { BottomNav } from './BottomNav';
import { MobileHeader } from './MobileHeader';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from '@/components/ui/sheet';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="md:hidden p-4 border-b border-border bg-card sticky top-0 z-40">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">Menu de Navegação</SheetTitle>
              <SheetDescription className="sr-only">
                Navegue pelas diferentes seções do WinCenter
              </SheetDescription>
              <SidebarContent onNavigate={() => setSheetOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
        <div className="pb-4 md:pb-0">
          {children}
        </div>
      </main>
    </div>
  );
}
