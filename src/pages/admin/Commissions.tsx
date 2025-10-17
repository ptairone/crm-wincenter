import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, Clock, CheckCircle, XCircle, Edit, RefreshCw, Filter, X, User } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';

interface UserInfo {
  auth_user_id: string;
  name: string;
  email: string;
  role: string;
}

interface Commission {
  id: string;
  base: string;
  percent: number;
  amount: number;
  pay_status: string;
  pay_status_date: string | null;
  notes: string | null;
  receipt_url: string | null;
  created_at: string;
  sale_id: string;
  seller_auth_id: string;
  receiver?: UserInfo;
  sales?: {
    sold_at: string;
    gross_value: number;
    clients?: {
      farm_name: string;
      contact_name: string;
    };
  };
}

export default function AdminCommissions() {
  const { user, userRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);
  const [editData, setEditData] = useState({
    pay_status: '',
    notes: '',
  });

  // Estados de filtros aplicados
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  
  // Estados temporários dos filtros (antes de aplicar)
  const [tempSelectedUsers, setTempSelectedUsers] = useState<string[]>([]);
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(undefined);
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(undefined);

  // Inicializar filtros da URL ou defaults
  useEffect(() => {
    const usersParam = searchParams.get('users');
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    const isAdmin = userRole === 'admin';
    
    if (usersParam) {
      const userIds = usersParam.split(',');
      setSelectedUsers(userIds);
      setTempSelectedUsers(userIds);
    } else if (!isAdmin && user) {
      // Seller/Técnico: pré-filtrar por ele mesmo
      setSelectedUsers([user.id]);
      setTempSelectedUsers([user.id]);
    }

    if (startParam) {
      setStartDate(new Date(startParam));
      setTempStartDate(new Date(startParam));
    } else {
      // Default: início do mês atual
      const defaultStart = startOfMonth(new Date());
      setStartDate(defaultStart);
      setTempStartDate(defaultStart);
    }

    if (endParam) {
      setEndDate(new Date(endParam));
      setTempEndDate(new Date(endParam));
    } else {
      // Default: fim do mês atual
      const defaultEnd = endOfMonth(new Date());
      setEndDate(defaultEnd);
      setTempEndDate(defaultEnd);
    }
  }, [searchParams, userRole, user]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchCommissions();
  }, [selectedUsers, startDate, endDate, user]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('auth_user_id, name, email, role')
        .in('role', ['seller', 'admin', 'technician'])
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchCommissions = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('commissions')
        .select(`
          *,
          sales (
            sold_at,
            gross_value,
            clients (
              farm_name,
              contact_name
            )
          )
        `)
        .order('created_at', { ascending: false });

      // Aplicar filtro de usuários
      if (selectedUsers.length > 0) {
        query = query.in('seller_auth_id', selectedUsers);
      } else if (userRole !== 'admin' && user) {
        // Não-admin: ver apenas suas comissões
        query = query.eq('seller_auth_id', user.id);
      }

      // Aplicar filtro de período
      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      // Buscar informações dos recebedores
      const commissionsWithReceivers = await Promise.all(
        (data || []).map(async (commission) => {
          const { data: userData } = await supabase
            .from('users')
            .select('auth_user_id, name, email, role')
            .eq('auth_user_id', commission.seller_auth_id)
            .single();

          return {
            ...commission,
            receiver: userData || undefined,
          };
        })
      );

      setCommissions(commissionsWithReceivers);
    } catch (error) {
      console.error('Error fetching commissions:', error);
      toast.error('Erro ao carregar comissões');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    // Atualizar estados aplicados
    setSelectedUsers(tempSelectedUsers);
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);

    // Atualizar URL
    const params = new URLSearchParams();
    if (tempSelectedUsers.length > 0) {
      params.set('users', tempSelectedUsers.join(','));
    }
    if (tempStartDate) {
      params.set('start', tempStartDate.toISOString().split('T')[0]);
    }
    if (tempEndDate) {
      params.set('end', tempEndDate.toISOString().split('T')[0]);
    }
    setSearchParams(params);
  };

  const clearFilters = () => {
    const isAdmin = userRole === 'admin';
    const defaultStart = startOfMonth(new Date());
    const defaultEnd = endOfMonth(new Date());

    // Admin: limpa todos os filtros
    // Seller/Técnico: mantém filtro por usuário mas limpa período
    const clearedUsers = isAdmin ? [] : (user ? [user.id] : []);
    
    setTempSelectedUsers(clearedUsers);
    setTempStartDate(defaultStart);
    setTempEndDate(defaultEnd);
    setSelectedUsers(clearedUsers);
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setSearchParams({});
  };

  const processAllSales = async () => {
    try {
      setLoading(true);
      toast.info('Processando vendas...');

      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('id')
        .eq('status', 'closed');

      if (salesError) throw salesError;

      for (const sale of sales || []) {
        const { error } = await supabase.rpc('create_commission_for_sale', {
          p_sale_id: sale.id
        });
        
        if (error) {
          console.error('Error processing sale:', sale.id, error);
        }
      }

      toast.success(`${sales?.length || 0} vendas processadas com sucesso!`);
      fetchCommissions();
    } catch (error: any) {
      console.error('Error processing sales:', error);
      toast.error('Erro ao processar vendas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (commission: Commission) => {
    setSelectedCommission(commission);
    setEditData({
      pay_status: commission.pay_status,
      notes: commission.notes || '',
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedCommission) return;

    try {
      const updateData: any = {
        pay_status: editData.pay_status,
        notes: editData.notes || null,
      };

      if (editData.pay_status === 'paid' || editData.pay_status === 'canceled') {
        updateData.pay_status_date = new Date().toISOString();
      } else {
        updateData.pay_status_date = null;
      }

      const { error } = await supabase
        .from('commissions')
        .update(updateData)
        .eq('id', selectedCommission.id);

      if (error) throw error;

      toast.success('Comissão atualizada com sucesso!');
      setEditDialogOpen(false);
      fetchCommissions();
    } catch (error: any) {
      console.error('Error updating commission:', error);
      toast.error('Erro ao atualizar comissão');
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
      spraying: 'Pulverização',
      maintenance: 'Manutenção',
      revision: 'Revisão',
    };
    return bases[base] || base;
  };

  const toggleUserSelection = (userId: string) => {
    setTempSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
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

  const isAdmin = userRole === 'admin';

  if (loading && commissions.length === 0) {
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
            <h1 className="text-3xl font-bold">Gestão de Comissões</h1>
            <p className="text-muted-foreground">Gerencie e acompanhe todas as comissões</p>
          </div>
          {isAdmin && (
            <Button onClick={processAllSales} variant="outline" className="gap-2" disabled={loading}>
              <RefreshCw className="h-4 w-4" />
              Processar Vendas
            </Button>
          )}
        </div>

        {/* Área de Filtros */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              <CardTitle>Filtros</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {/* Filtro de Usuário */}
              <div className="space-y-2">
                <Label>Usuário(s)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <User className="mr-2 h-4 w-4" />
                      {tempSelectedUsers.length === 0
                        ? 'Todos os usuários'
                        : tempSelectedUsers.length === 1
                        ? users.find(u => u.auth_user_id === tempSelectedUsers[0])?.name || 'Usuário'
                        : `${tempSelectedUsers.length} usuários selecionados`}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <div className="max-h-[300px] overflow-y-auto p-2">
                      {users.map((u) => (
                        <div
                          key={u.auth_user_id}
                          className="flex items-center space-x-2 p-2 hover:bg-accent rounded cursor-pointer"
                          onClick={() => toggleUserSelection(u.auth_user_id)}
                        >
                          <Checkbox
                            checked={tempSelectedUsers.includes(u.auth_user_id)}
                            onCheckedChange={() => toggleUserSelection(u.auth_user_id)}
                          />
                          <div className="flex items-center gap-2 flex-1">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {u.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{u.name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Data Início */}
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      {tempStartDate ? format(tempStartDate, 'dd/MM/yyyy') : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={tempStartDate}
                      onSelect={setTempStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Data Fim */}
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      {tempEndDate ? format(tempEndDate, 'dd/MM/yyyy') : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={tempEndDate}
                      onSelect={setTempEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={applyFilters} className="gap-2">
                <Filter className="h-4 w-4" />
                Aplicar Filtros
              </Button>
              <Button onClick={clearFilters} variant="outline" className="gap-2">
                <X className="h-4 w-4" />
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
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

        {/* Tabela de Comissões */}
        <Card>
          <CardHeader>
            <CardTitle>Todas as Comissões</CardTitle>
          </CardHeader>
          <CardContent>
            {commissions.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma comissão encontrada</h3>
                <p className="text-muted-foreground mb-4">
                  {isAdmin 
                    ? 'Clique em "Processar Vendas" para gerar comissões das vendas existentes.'
                    : 'Você ainda não possui comissões registradas no período selecionado.'}
                </p>
                {isAdmin && (
                  <Button onClick={processAllSales} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Processar Vendas
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Base</TableHead>
                    <TableHead>%</TableHead>
                    <TableHead>Valor da Venda</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Recebedor</TableHead>
                    <TableHead>Status</TableHead>
                    {isAdmin && <TableHead>Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.map((commission) => {
                    const statusInfo = getStatusInfo(commission.pay_status);
                    const StatusIcon = statusInfo.icon;

                    return (
                      <TableRow key={commission.id} className="hover:bg-muted/50">
                        <TableCell>
                          {commission.sales?.sold_at
                            ? new Date(commission.sales.sold_at).toLocaleDateString('pt-BR')
                            : new Date(commission.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {commission.sales?.clients?.farm_name || 
                             commission.sales?.clients?.contact_name || 
                             'Cliente não informado'}
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
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {commission.receiver?.name.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{commission.receiver?.name || 'Usuário'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusInfo.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(commission)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Edição */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Comissão</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Status *</Label>
                <Select
                  value={editData.pay_status}
                  onValueChange={(value) => setEditData({ ...editData, pay_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="canceled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={editData.notes}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  placeholder="Adicione observações sobre esta comissão..."
                  rows={4}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleUpdate} className="flex-1">
                  Salvar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
