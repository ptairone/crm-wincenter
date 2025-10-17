import { NavLink } from 'react-router-dom';
import {
  Home,
  Users,
  TrendingUp,
  DollarSign,
  Package,
  BarChart3,
  Target,
  Receipt,
  Settings,
  Bell,
  UserPlus,
  Leaf,
  Sparkles,
  Calendar,
  Presentation,
  ShoppingCart,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useNotifications } from '@/hooks/useNotifications';
import { Badge } from '@/components/ui/badge';
import { useSiteSettings } from '@/hooks/useSiteSettings';

const sellerLinks = [
  { to: '/seller/dashboard', icon: Home, label: 'Dashboard' },
  { to: '/seller/clients', icon: Users, label: 'Clientes' },
  { to: '/seller/opportunities', icon: TrendingUp, label: 'Oportunidades' },
  { to: '/seller/products', icon: Package, label: 'Produtos' },
  { to: '/seller/sales', icon: ShoppingCart, label: 'Vendas' },
  { to: '/seller/commissions', icon: DollarSign, label: 'Comissões' },
  { to: '/seller/visits', icon: Calendar, label: 'Visitas' },
  { to: '/seller/demonstrations', icon: Presentation, label: 'Demonstrações' },
  { to: '/seller/warranties', icon: ShieldCheck, label: 'Garantias' },
  { to: '/seller/reports', icon: Receipt, label: 'Relatórios' },
  { to: '/notifications', icon: Bell, label: 'Notificações' },
];

const adminLinks = [
  { to: '/admin/dashboard', icon: Home, label: 'Dashboard' },
  { to: '/admin/reports', icon: BarChart3, label: 'Relatórios' },
  { to: '/admin/sales', icon: ShoppingCart, label: 'Vendas' },
  { to: '/admin/products', icon: Package, label: 'Produtos' },
  { to: '/admin/goals', icon: Target, label: 'Metas' },
  { to: '/admin/company-costs', icon: Receipt, label: 'Custos' },
  { to: '/admin/commission-rules', icon: Settings, label: 'Regras Comissão' },
  { to: '/admin/commissions', icon: DollarSign, label: 'Gestão Comissões' },
  { to: '/admin/users-invites', icon: UserPlus, label: 'Convites' },
  { to: '/admin/site-settings', icon: Sparkles, label: 'Configurações' },
];

interface SidebarContentProps {
  onNavigate?: () => void;
}

export function SidebarContent({ onNavigate }: SidebarContentProps) {
  const { signOut, userRole, userName } = useAuth();
  const { unreadCount } = useNotifications();
  const { settings } = useSiteSettings();

  const handleNavClick = () => {
    onNavigate?.();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <img 
            src={settings?.logo_url || '/logo.png'} 
            alt="WinCenter" 
            className="h-10 w-10 rounded-lg object-contain"
          />
          <div>
            <h1 className="text-lg font-bold text-foreground">WinCenter</h1>
            <p className="text-xs text-muted-foreground">Agriculture CRM</p>
            <p className="text-xs text-foreground mt-1">Bem-Vindo <span className="font-bold">{userName}</span></p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {userRole === 'admin' && (
            <div>
              <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Administração
              </h3>
              <nav className="space-y-1">
                {adminLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={handleNavClick}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-foreground hover:bg-accent/50 hover:text-accent-foreground'
                      )
                    }
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </NavLink>
                ))}
              </nav>
            </div>
          )}

          <div>
            <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {userRole === 'technician' ? 'Técnico' : 'Vendedor'}
            </h3>
            <nav className="space-y-1">
              {sellerLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-foreground hover:bg-accent/50 hover:text-accent-foreground'
                    )
                  }
                >
                  <link.icon className="h-4 w-4" />
                  <span className="flex-1">{link.label}</span>
                  {link.to === '/notifications' && unreadCount > 0 && (
                    <Badge variant="default" className="h-5 min-w-5 px-1.5 text-xs">
                      {unreadCount}
                    </Badge>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <Button
          variant="outline"
          className="w-full"
          onClick={signOut}
        >
          Sair
        </Button>
      </div>
    </div>
  );
}
