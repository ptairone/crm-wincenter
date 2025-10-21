import { NavLink } from 'react-router-dom';
import { Home, Users, TrendingUp, Package, Bell, ShieldCheck, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/useNotifications';

const sellerLinks = [
  { to: '/seller/dashboard', icon: Home, label: 'Dashboard' },
  { to: '/seller/clients', icon: Users, label: 'Clientes' },
  { to: '/seller/opportunities', icon: TrendingUp, label: 'Funil' },
  { to: '/seller/sales', icon: Package, label: 'Vendas' },
  { to: '/seller/warranties', icon: ShieldCheck, label: 'Garantias' },
  { to: '/seller/service-orders', icon: FileText, label: 'O.S' },
  { to: '/seller/reports', icon: Package, label: 'Relatórios' },
  { to: '/notifications', icon: Bell, label: 'Notificações' },
];

export function BottomNav() {
  const { unreadCount } = useNotifications();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/98 backdrop-blur-md border-t border-border shadow-lg">
      <div className="flex items-center justify-around h-16 px-1 max-w-screen-sm mx-auto">
        {sellerLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center flex-1 h-14 gap-1 transition-all rounded-xl mx-0.5 relative',
                isActive
                  ? 'text-primary bg-primary/10 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <link.icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
                  {link.to === '/notifications' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className={cn(
                  "text-[11px] font-medium leading-none",
                  isActive && "font-semibold"
                )}>
                  {link.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
