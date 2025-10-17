import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, ShoppingCart, CheckCircle2, Clock } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Sale {
  id: string;
  sold_at: string;
  gross_value: number;
  estimated_profit: number;
  total_cost: number;
  status: string;
  tax_percent: number;
  region: string;
  payment_received: boolean;
  payment_method_1: string | null;
  payment_method_2: string | null;
  clients?: {
    farm_name: string;
    contact_name: string;
  };
  seller_name?: string;
}

export default function AdminSales() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSeller, setSelectedSeller] = useState<string>('all');
  const [sellers, setSellers] = useState<any[]>([]);

  useEffect(() => {
    fetchSellers();
  }, []);

  useEffect(() => {
    fetchSales();
  }, [selectedSeller]);

  const fetchSellers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, auth_user_id, name')
        .in('role', ['seller', 'admin', 'technician'])
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setSellers(data || []);
    } catch (error) {
      console.error('Error fetching sellers:', error);
    }
  };

  const fetchSales = async () => {
    try {
      let query = supabase
        .from('sales')
        .select(`
          *,
          clients (
            farm_name,
            contact_name
          )
        `)
        .order('sold_at', { ascending: false });

      if (selectedSeller !== 'all') {
        query = query.eq('seller_auth_id', selectedSeller);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Buscar nomes dos vendedores separadamente
      const sellerAuthIds = [...new Set(data?.map(s => s.seller_auth_id).filter(Boolean))];
      const { data: usersData } = await supabase
        .from('users')
        .select('auth_user_id, name')
        .in('auth_user_id', sellerAuthIds);

      const usersMap = new Map(usersData?.map(u => [u.auth_user_id, u.name]));

      // Mapear dados do vendedor
      const salesWithSellers = (data || []).map((sale: any) => ({
        ...sale,
        seller_name: usersMap.get(sale.seller_auth_id) || 'N/A'
      }));

      setSales(salesWithSellers);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status: string) => {
    const statuses: Record<string, { label: string; color: string }> = {
      closed: { label: 'Fechada', color: 'bg-green-100 text-green-800' },
      canceled: { label: 'Cancelada', color: 'bg-red-100 text-red-800' },
    };
    return statuses[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
  };

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthSales = sales.filter(s => 
    s.sold_at.slice(0, 7) === currentMonth && s.status === 'closed'
  );

  const totalRevenue = sales
    .filter(s => s.status === 'closed')
    .reduce((sum, s) => sum + Number(s.gross_value), 0);

  const totalProfit = sales
    .filter(s => s.status === 'closed')
    .reduce((sum, s) => sum + Number(s.estimated_profit), 0);

  const monthRevenue = monthSales.reduce((sum, s) => sum + Number(s.gross_value), 0);

  const receivedSales = sales.filter(s => s.status === 'closed' && s.payment_received);
  const pendingSales = sales.filter(s => s.status === 'closed' && !s.payment_received);
  
  const totalReceived = receivedSales.reduce((sum, s) => sum + Number(s.gross_value), 0);
  const totalPending = pendingSales.reduce((sum, s) => sum + Number(s.gross_value), 0);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold">Vendas - Visão Administrativa</h1>
            <p className="text-muted-foreground">Histórico completo de vendas</p>
          </div>
          <div className="w-full md:w-64">
            <Label htmlFor="seller-filter">Filtrar por Vendedor</Label>
            <Select value={selectedSeller} onValueChange={setSelectedSeller}>
              <SelectTrigger id="seller-filter">
                <SelectValue placeholder="Todos os vendedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os vendedores</SelectItem>
                {sellers.map((seller) => (
                  <SelectItem key={seller.auth_user_id} value={seller.auth_user_id}>
                    {seller.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Cards de Métricas */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Vendas do Mês</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{monthSales.length}</div>
              <p className="text-xs text-muted-foreground">vendas fechadas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita do Mês</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                }).format(monthRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">valor bruto</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                }).format(totalRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">todas as vendas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Lucro Estimado</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                }).format(totalProfit)}
              </div>
              <p className="text-xs text-muted-foreground">todas as vendas</p>
            </CardContent>
          </Card>
        </div>

        {/* Cards de Recebimento */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valores Recebidos</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {new Intl.NumberFormat('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                }).format(totalReceived)}
              </div>
              <p className="text-xs text-muted-foreground">{receivedSales.length} vendas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valores Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {new Intl.NumberFormat('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                }).format(totalPending)}
              </div>
              <p className="text-xs text-muted-foreground">{pendingSales.length} vendas</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Vendas */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Valor Bruto</TableHead>
                    <TableHead>Lucro Est.</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Forma Pagto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        Nenhuma venda encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    sales.map((sale) => {
                      const statusInfo = getStatusInfo(sale.status);
                      return (
                        <TableRow key={sale.id}>
                          <TableCell>
                            {new Date(sale.sold_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{sale.clients?.farm_name}</span>
                              <span className="text-sm text-muted-foreground">
                                {sale.clients?.contact_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{sale.seller_name}</TableCell>
                          <TableCell>
                            <Badge className={statusInfo.color}>
                              {statusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {new Intl.NumberFormat('pt-BR', { 
                              style: 'currency', 
                              currency: 'BRL' 
                            }).format(Number(sale.gross_value))}
                          </TableCell>
                          <TableCell className="text-green-600 font-medium">
                            {new Intl.NumberFormat('pt-BR', { 
                              style: 'currency', 
                              currency: 'BRL' 
                            }).format(Number(sale.estimated_profit))}
                          </TableCell>
                          <TableCell>
                            {sale.payment_received ? (
                              <Badge className="bg-green-100 text-green-800">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Recebido
                              </Badge>
                            ) : (
                              <Badge className="bg-orange-100 text-orange-800">
                                <Clock className="h-3 w-3 mr-1" />
                                Pendente
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col text-sm">
                              {sale.payment_method_1 && <span>{sale.payment_method_1}</span>}
                              {sale.payment_method_2 && <span className="text-muted-foreground">{sale.payment_method_2}</span>}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
