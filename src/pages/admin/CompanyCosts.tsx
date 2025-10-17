import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Receipt, TrendingDown, Calendar } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface CompanyCost {
  id: string;
  cost_type: string;
  category: string;
  description: string;
  monthly_value: number;
  competence_ym: string;
  notes: string;
  created_at: string;
}

export default function CompanyCosts() {
  const [costs, setCosts] = useState<CompanyCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    cost_type: 'fixed',
    category: '',
    description: '',
    monthly_value: '',
    competence_ym: new Date().toISOString().slice(0, 7),
    notes: '',
  });

  useEffect(() => {
    fetchCosts();
  }, []);

  const fetchCosts = async () => {
    try {
      const { data, error } = await supabase
        .from('company_costs')
        .select('*')
        .order('competence_ym', { ascending: false });

      if (error) throw error;
      setCosts(data || []);
    } catch (error) {
      console.error('Error fetching costs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeInfo = (type: string) => {
    const types: Record<string, { label: string; color: string }> = {
      fixed: { label: 'Fixo', color: 'bg-blue-100 text-blue-800' },
      variable: { label: 'Variável', color: 'bg-purple-100 text-purple-800' },
    };
    return types[type] || { label: type, color: 'bg-gray-100 text-gray-800' };
  };

  const formatPeriod = (periodYm: string) => {
    const [year, month] = periodYm.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const costData: any = {
        cost_type: formData.cost_type,
        category: formData.category || null,
        description: formData.description || null,
        monthly_value: Number(formData.monthly_value),
        competence_ym: formData.competence_ym,
        notes: formData.notes || null,
      };

      const { error } = await supabase
        .from('company_costs')
        .insert([costData]);

      if (error) throw error;

      toast.success('Custo registrado com sucesso!');
      setDialogOpen(false);
      setFormData({
        cost_type: 'fixed',
        category: '',
        description: '',
        monthly_value: '',
        competence_ym: new Date().toISOString().slice(0, 7),
        notes: '',
      });
      fetchCosts();
    } catch (error: any) {
      console.error('Error creating cost:', error);
      toast.error('Erro ao registrar custo: ' + error.message);
    }
  };

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthCosts = costs.filter(c => c.competence_ym === currentMonth);
  const monthTotal = monthCosts.reduce((sum, c) => sum + Number(c.monthly_value), 0);

  const fixedCosts = costs.filter(c => c.cost_type === 'fixed');
  const variableCosts = costs.filter(c => c.cost_type === 'variable');

  const totalFixed = fixedCosts.reduce((sum, c) => sum + Number(c.monthly_value), 0);
  const totalVariable = variableCosts.reduce((sum, c) => sum + Number(c.monthly_value), 0);
  const totalCosts = costs.reduce((sum, c) => sum + Number(c.monthly_value), 0);

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
            <h1 className="text-3xl font-bold">Custos da Empresa</h1>
            <p className="text-muted-foreground">Controle de despesas operacionais</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Custo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Novo Custo</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cost_type">Tipo de Custo *</Label>
                    <Select
                      value={formData.cost_type}
                      onValueChange={(value) => setFormData({ ...formData, cost_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixo</SelectItem>
                        <SelectItem value="variable">Variável</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="monthly_value">Valor Mensal (R$) *</Label>
                    <Input
                      id="monthly_value"
                      type="number"
                      step="0.01"
                      value={formData.monthly_value}
                      onChange={(e) => setFormData({ ...formData, monthly_value: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="competence_ym">Competência *</Label>
                    <Input
                      id="competence_ym"
                      type="month"
                      value={formData.competence_ym}
                      onChange={(e) => setFormData({ ...formData, competence_ym: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full">
                  Registrar Custo
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Custos do Mês</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(monthTotal)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {monthCosts.length} lançamentos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Custos Fixos</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(totalFixed)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {fixedCosts.length} registros
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Custos Variáveis</CardTitle>
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(totalVariable)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {variableCosts.length} registros
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Total Acumulado</CardTitle>
              <Receipt className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(totalCosts)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {costs.length} registros totais
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Custos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Competência</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum custo registrado
                    </TableCell>
                  </TableRow>
                ) : (
                  costs.map((cost) => {
                    const typeInfo = getTypeInfo(cost.cost_type);

                    return (
                      <TableRow key={cost.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <div className="font-medium">{formatPeriod(cost.competence_ym)}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={typeInfo.color}>
                            {typeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{cost.category || 'Sem categoria'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-md">
                            {cost.description || '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-bold text-red-600">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(cost.monthly_value)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground max-w-xs truncate">
                            {cost.notes || '-'}
                          </div>
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
