import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Commission {
  id: string;
  base: string;
  percent: number;
  amount: number;
  pay_status: string;
  pay_status_date: string;
  notes: string;
  created_at: string;
  sale_id: string;
  sales?: {
    sold_at: string;
    gross_value: number;
    clients?: {
      farm_name: string;
    };
  };
}

export default function Commissions() {
  const { user, userRole } = useAuth();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCommissions();
  }, [user]);

  const fetchCommissions = async () => {
    try {
      let query = supabase
        .from('commissions')
        .select(`
          *,
          sales (
            sold_at,
            gross_value,
            clients (
              farm_name
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (userRole === 'seller' || userRole === 'technician') {
        query = query.eq('seller_auth_id', user?.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCommissions(data || []);
    } catch (error) {
      console.error('Error fetching commissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status: string) => {
    const statuses: Record<string, { label: string; color: string; icon: any }> = {
      pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      paid: { label: 'Pago', color: 'bg-green-100 text-green-800', icon: CheckCircle },
      canceled: { label: 'Cancelado', color: 'bg-red-100 text-red-800', icon: XCircle },
    };
    return statuses[status] || { label: status, color: 'bg-gray-100 text-gray-800', icon: Clock };
  };

  const getBaseLabel = (base: string) => {
    const bases: Record<string, string> = {
      gross: 'Valor Bruto',
      profit: 'Lucro',
    };
    return bases[base] || base;
  };

  const totalPending = commissions
    .filter(c => c.pay_status === 'pending')
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const totalPaid = commissions
    .filter(c => c.pay_status === 'paid')
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const totalCanceled = commissions
    .filter(c => c.pay_status === 'canceled')
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const totalAmount = commissions.reduce((sum, c) => sum + Number(c.amount), 0);

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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Comissões</h1>
            <p className="text-muted-foreground">Acompanhe suas comissões</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Total Acumulado</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(totalAmount)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {commissions.length} comissões registradas
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Pendente</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(totalPending)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {commissions.filter(c => c.pay_status === 'pending').length} pendentes
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Pago</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(totalPaid)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {commissions.filter(c => c.pay_status === 'paid').length} pagas
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Cancelado</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(totalCanceled)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {commissions.filter(c => c.pay_status === 'canceled').length} canceladas
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Comissões</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead>Valor da Venda</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma comissão encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  commissions.map((commission) => {
                    const statusInfo = getStatusInfo(commission.pay_status);
                    const StatusIcon = statusInfo.icon;

                    return (
                      <TableRow key={commission.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          {commission.sales?.sold_at
                            ? new Date(commission.sales.sold_at).toLocaleDateString('pt-BR')
                            : new Date(commission.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {commission.sales?.clients?.farm_name || 'Cliente não informado'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getBaseLabel(commission.base)}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{commission.percent}%</span>
                        </TableCell>
                        <TableCell>
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(commission.sales?.gross_value || 0)}
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-green-600">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(commission.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusInfo.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
