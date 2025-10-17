import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Target, Users, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function SellerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    monthSales: 0,
    avgTicket: 0,
    conversion: 0,
    pendingCommissions: 0,
  });

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);

      // Fetch sales do mês atual (para métricas de desempenho)
      const { data: sales } = await supabase
        .from('sales')
        .select('gross_value')
        .eq('seller_auth_id', user?.id)
        .gte('sold_at', `${currentMonth}-01`)
        .eq('status', 'closed');

      const totalSales = sales?.reduce((sum, s) => sum + Number(s.gross_value), 0) || 0;
      const avgTicket = sales && sales.length > 0 ? totalSales / sales.length : 0;

      // Fetch TODAS as comissões pendentes (sem filtro de data)
      const { data: commissions } = await supabase
        .from('commissions')
        .select('amount')
        .eq('seller_auth_id', user?.id)
        .eq('pay_status', 'pending');

      const pendingComm = commissions?.reduce((sum, c) => sum + Number(c.amount), 0) || 0;

      setStats({
        monthSales: totalSales,
        avgTicket,
        conversion: 0, // TODO: Calculate from opportunities
        pendingCommissions: pendingComm,
      });
    } catch (error) {
      // Silently handle dashboard data errors - UI will show empty state
    }
  };

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral das suas atividades</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vendas do Mês</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(stats.monthSales)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(stats.avgTicket)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.conversion}%</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comissões Pendentes</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(stats.pendingCommissions)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ações Rápidas</CardTitle>
            <CardDescription>Acesse rapidamente as funções mais usadas</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Button
              onClick={() => navigate('/seller/clients')}
              className="w-full"
            >
              <Users className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
            <Button
              onClick={() => navigate('/seller/opportunities')}
              variant="outline"
              className="w-full"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Nova Oportunidade
            </Button>
            <Button
              onClick={() => navigate('/seller/sales')}
              variant="outline"
              className="w-full"
            >
              <Plus className="mr-2 h-4 w-4" />
              Registrar Venda
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
