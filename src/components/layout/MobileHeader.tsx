import { useAuth } from '@/lib/auth';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export function MobileHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
      <div className="flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-2">
          <img 
            src="/logo.png" 
            alt="WinCenter" 
            className="h-10 w-auto object-contain"
          />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-primary">WinCenter</span>
            <span className="text-xs text-muted-foreground">Agriculture</span>
          </div>
        </div>
        {user && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-9 w-9"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
}
