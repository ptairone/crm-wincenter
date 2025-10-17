import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, TrendingUp, DollarSign, Edit, Trash2, ShoppingCart } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { ClientAutocomplete } from '@/components/ClientAutocomplete';

interface Opportunity {
  id: string;
  stage: string;
  probability: number;
  gross_value: number;
  estimated_margin: number;
  expected_close_date: string;
  client_id: string;
  product_ids?: string[];
  clients?: {
    farm_name: string;
    contact_name: string;
  };
}

export default function Opportunities() {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    client_id: '',
    stage: 'lead',
    probability: '10',
    gross_value: '',
    estimated_margin: '',
    expected_close_date: '',
    history: '',
    product_ids: [] as string[],
  });
  const [paymentData, setPaymentData] = useState({
    payment_method_1: '',
    payment_method_2: '',
  });

  useEffect(() => {
    fetchOpportunities();
    fetchClients();
    fetchProducts();
    if (userRole === 'admin') {
      fetchSellers();
    }
  }, [user, userRole]);

  const fetchClients = async () => {
    try {
      let query = supabase.from('clients').select('id, farm_name, contact_name');
      
      if (userRole === 'seller' || userRole === 'technician') {
        query = query.or(`seller_auth_id.eq.${user?.id},owner_user_id.eq.${user?.id}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, price, category')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

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

  const fetchOpportunities = async () => {
    try {
      let query = supabase
        .from('opportunities')
        .select(`
          *,
          clients (
            farm_name,
            contact_name
          )
        `)
        .not('stage', 'in', '(won,lost)') // Excluir oportunidades ganhas e perdidas
        .order('created_at', { ascending: false });

      if (userRole === 'seller' || userRole === 'technician') {
        query = query.eq('seller_auth_id', user?.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setOpportunities(data || []);
    } catch (error) {
      console.error('Error fetching opportunities:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate gross value from selected products
  const calculateGrossValueFromProducts = (productIds: string[]) => {
    if (productIds.length === 0) return 0;
    return productIds.reduce((sum, productId) => {
      const product = products.find(p => p.id === productId);
      return sum + (product?.price || 0);
    }, 0);
  };

  const getStageInfo = (stage: string) => {
    const stages: Record<string, { label: string; color: string }> = {
      lead: { label: 'Lead', color: 'bg-blue-100 text-blue-800' },
      qualified: { label: 'Qualificado', color: 'bg-purple-100 text-purple-800' },
      proposal: { label: 'Proposta', color: 'bg-yellow-100 text-yellow-800' },
      closing: { label: 'Fechamento', color: 'bg-orange-100 text-orange-800' },
      won: { label: 'Ganha', color: 'bg-green-100 text-green-800' },
      lost: { label: 'Perdida', color: 'bg-red-100 text-red-800' },
    };
    return stages[stage] || { label: stage, color: 'bg-gray-100 text-gray-800' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Calculate gross value from products if products are selected
      const calculatedGrossValue = formData.product_ids.length > 0 
        ? calculateGrossValueFromProducts(formData.product_ids)
        : Number(formData.gross_value);

      const oppData: any = {
        client_id: formData.client_id,
        seller_auth_id: user?.id,
        stage: formData.stage,
        probability: Number(formData.probability),
        gross_value: calculatedGrossValue,
        estimated_margin: Number(formData.estimated_margin) || null,
        expected_close_date: formData.expected_close_date || null,
        history: formData.history || null,
        product_ids: formData.product_ids.length > 0 ? formData.product_ids : null,
      };

      const { error } = await supabase
        .from('opportunities')
        .insert([oppData]);

      if (error) throw error;

      toast.success('Oportunidade criada com sucesso!');
      setDialogOpen(false);
      setFormData({
        client_id: '',
        stage: 'lead',
        probability: '10',
        gross_value: '',
        estimated_margin: '',
        expected_close_date: '',
        history: '',
        product_ids: [],
      });
      fetchOpportunities();
    } catch (error: any) {
      console.error('Error creating opportunity:', error);
      toast.error('Erro ao criar oportunidade: ' + error.message);
    }
  };

  const handleEdit = (opp: Opportunity) => {
    setSelectedOpp(opp);
    setFormData({
      client_id: opp.client_id,
      stage: opp.stage,
      probability: String(opp.probability || 0),
      gross_value: String(opp.gross_value || 0),
      estimated_margin: String(opp.estimated_margin || 0),
      expected_close_date: opp.expected_close_date || '',
      history: '',
      product_ids: opp.product_ids || [],
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOpp) return;

    try {
      // Calculate gross value from products if products are selected
      const calculatedGrossValue = formData.product_ids.length > 0 
        ? calculateGrossValueFromProducts(formData.product_ids)
        : Number(formData.gross_value);

      const { error } = await supabase
        .from('opportunities')
        .update({
          client_id: formData.client_id,
          stage: formData.stage as any,
          probability: Number(formData.probability),
          gross_value: calculatedGrossValue,
          estimated_margin: Number(formData.estimated_margin) || null,
          expected_close_date: formData.expected_close_date || null,
          product_ids: formData.product_ids.length > 0 ? formData.product_ids : null,
        })
        .eq('id', selectedOpp.id);

      if (error) throw error;

      toast.success('Oportunidade atualizada!');
      setEditDialogOpen(false);
      setSelectedOpp(null);
      fetchOpportunities();
    } catch (error: any) {
      toast.error('Erro ao atualizar: ' + error.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedOpp) return;

    try {
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', selectedOpp.id);

      if (error) throw error;

      toast.success('Oportunidade excluída!');
      setDeleteDialogOpen(false);
      setSelectedOpp(null);
      fetchOpportunities();
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
    }
  };

  const handleConvertToSale = (opp: Opportunity) => {
    setSelectedOpp(opp);
    setPaymentData({
      payment_method_1: '',
      payment_method_2: '',
    });
    setConvertDialogOpen(true);
  };

  const handleConfirmConvertToSale = async () => {
    if (!selectedOpp) return;

    try {
      // Create the sale
      const saleData = {
        client_id: selectedOpp.client_id,
        seller_auth_id: user?.id,
        status: 'closed' as const,
        gross_value: selectedOpp.gross_value,
        total_cost: 0,
        estimated_profit: selectedOpp.gross_value * (selectedOpp.estimated_margin / 100 || 0),
        payment_method_1: paymentData.payment_method_1 || null,
        payment_method_2: paymentData.payment_method_2 || null,
        sold_at: new Date().toISOString(),
      };

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert([saleData])
        .select()
        .single();

      if (saleError) throw saleError;

      // If there are products, create sale items
      if (selectedOpp.product_ids && selectedOpp.product_ids.length > 0) {
        const saleItems = selectedOpp.product_ids.map(productId => {
          const product = products.find(p => p.id === productId);
          return {
            sale_id: sale.id,
            product_id: productId,
            qty: 1,
            unit_price: product?.price || 0,
            discount_percent: 0,
          };
        });

        const { error: itemsError } = await supabase
          .from('sale_items')
          .insert(saleItems);

        if (itemsError) throw itemsError;
      }

      // Update opportunity to won
      const { error: oppError } = await supabase
        .from('opportunities')
        .update({ stage: 'won' })
        .eq('id', selectedOpp.id);

      if (oppError) throw oppError;

      toast.success('Oportunidade convertida em venda com sucesso!');
      setConvertDialogOpen(false);
      setSelectedOpp(null);
      fetchOpportunities();
    } catch (error: any) {
      console.error('Error converting opportunity to sale:', error);
      toast.error('Erro ao converter oportunidade: ' + error.message);
    }
  };

  const statsByStage = opportunities.reduce((acc, opp) => {
    if (!acc[opp.stage]) {
      acc[opp.stage] = { count: 0, value: 0 };
    }
    acc[opp.stage].count++;
    acc[opp.stage].value += Number(opp.gross_value || 0);
    return acc;
  }, {} as Record<string, { count: number; value: number }>);

  const totalValue = opportunities.reduce((sum, opp) => sum + Number(opp.gross_value || 0), 0);
  const activeOpps = opportunities.filter(o => !['won', 'lost'].includes(o.stage));
  const closingOpps = opportunities.filter(o => o.stage === 'closing');

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
            <h1 className="text-3xl font-bold">Funil de Vendas</h1>
            <p className="text-muted-foreground">Acompanhe suas oportunidades</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Oportunidade
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova Oportunidade</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="client_id">Cliente *</Label>
                  <ClientAutocomplete
                    value={formData.client_id}
                    onChange={(value) => setFormData({ ...formData, client_id: value })}
                    userRole={userRole}
                    userId={user?.id}
                    sellers={sellers}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stage">Estágio *</Label>
                  <Select
                    value={formData.stage}
                    onValueChange={(value) => setFormData({ ...formData, stage: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="qualified">Qualificado</SelectItem>
                      <SelectItem value="proposal">Proposta</SelectItem>
                      <SelectItem value="closing">Fechamento</SelectItem>
                      <SelectItem value="won">Ganha</SelectItem>
                      <SelectItem value="lost">Perdida</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="probability">Probabilidade (%)</Label>
                    <Input
                      id="probability"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.probability}
                      onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estimated_margin">Margem Estimada (%)</Label>
                    <Input
                      id="estimated_margin"
                      type="number"
                      value={formData.estimated_margin}
                      onChange={(e) => setFormData({ ...formData, estimated_margin: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="product_ids">Produtos em Negociação (Opcional)</Label>
                  <Select
                    value={formData.product_ids[0] || 'none'}
                    onValueChange={(value) => {
                      const newProductIds = value !== 'none' ? [value] : [];
                      const calculatedValue = value !== 'none' ? calculateGrossValueFromProducts([value]) : 0;
                      setFormData({ 
                        ...formData, 
                        product_ids: newProductIds,
                        gross_value: calculatedValue > 0 ? String(calculatedValue) : formData.gross_value
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um produto (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum produto</SelectItem>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} - {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(product.price)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Se selecionar um produto, o valor bruto será calculado automaticamente
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gross_value">
                      Valor Bruto (R$) {formData.product_ids.length === 0 && '*'}
                    </Label>
                    <Input
                      id="gross_value"
                      type="number"
                      step="0.01"
                      value={formData.gross_value}
                      onChange={(e) => setFormData({ ...formData, gross_value: e.target.value })}
                      required={formData.product_ids.length === 0}
                      disabled={formData.product_ids.length > 0}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expected_close_date">Previsão de Fechamento</Label>
                    <Input
                      id="expected_close_date"
                      type="date"
                      value={formData.expected_close_date}
                      onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="history">Histórico/Observações</Label>
                  <Textarea
                    id="history"
                    value={formData.history}
                    onChange={(e) => setFormData({ ...formData, history: e.target.value })}
                    rows={3}
                  />
                </div>
                <Button type="submit" className="w-full">
                  Criar Oportunidade
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total de Oportunidades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{opportunities.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {activeOpps.length} em andamento
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  notation: 'compact',
                }).format(totalValue)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Ganhas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {statsByStage.won?.count || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  notation: 'compact',
                }).format(statsByStage.won?.value || 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Em Fechamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {closingOpps.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  notation: 'compact',
                }).format(statsByStage.closing?.value || 0)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pipeline de Oportunidades</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Estágio</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Probabilidade</TableHead>
                  <TableHead>Margem Est.</TableHead>
                  <TableHead>Previsão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma oportunidade encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  opportunities.map((opp) => {
                    const stageInfo = getStageInfo(opp.stage);
                    return (
                      <TableRow key={opp.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="font-medium">
                            {opp.clients?.farm_name || 'Cliente não informado'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {opp.clients?.contact_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={stageInfo.color}>
                            {stageInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(opp.gross_value || 0)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary transition-all"
                                style={{ width: `${opp.probability || 0}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium">{opp.probability || 0}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-muted-foreground" />
                            {opp.estimated_margin || 0}%
                          </div>
                        </TableCell>
                        <TableCell>
                          {opp.expected_close_date
                            ? new Date(opp.expected_close_date).toLocaleDateString('pt-BR')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            {!['won', 'lost'].includes(opp.stage) && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleConvertToSale(opp)}
                                title="Transformar em Venda"
                              >
                                <ShoppingCart className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(opp)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedOpp(opp);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Oportunidade</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_client_id">Cliente *</Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) => setFormData({ ...formData, client_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.farm_name} - {client.contact_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_stage">Estágio *</Label>
              <Select
                value={formData.stage}
                onValueChange={(value) => setFormData({ ...formData, stage: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="qualified">Qualificado</SelectItem>
                  <SelectItem value="proposal">Proposta</SelectItem>
                  <SelectItem value="closing">Fechamento</SelectItem>
                  <SelectItem value="won">Ganha</SelectItem>
                  <SelectItem value="lost">Perdida</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_probability">Probabilidade (%)</Label>
                <Input
                  id="edit_probability"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.probability}
                  onChange={(e) => setFormData({ ...formData, probability: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_estimated_margin">Margem Estimada (%)</Label>
                <Input
                  id="edit_estimated_margin"
                  type="number"
                  value={formData.estimated_margin}
                  onChange={(e) => setFormData({ ...formData, estimated_margin: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_product_ids">Produtos em Negociação (Opcional)</Label>
              <Select
                value={formData.product_ids[0] || 'none'}
                onValueChange={(value) => {
                  const newProductIds = value !== 'none' ? [value] : [];
                  const calculatedValue = value !== 'none' ? calculateGrossValueFromProducts([value]) : 0;
                  setFormData({ 
                    ...formData, 
                    product_ids: newProductIds,
                    gross_value: calculatedValue > 0 ? String(calculatedValue) : formData.gross_value
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um produto (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum produto</SelectItem>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name} - {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      }).format(product.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_gross_value">
                  Valor Bruto (R$) {formData.product_ids.length === 0 && '*'}
                </Label>
                <Input
                  id="edit_gross_value"
                  type="number"
                  step="0.01"
                  value={formData.gross_value}
                  onChange={(e) => setFormData({ ...formData, gross_value: e.target.value })}
                  required={formData.product_ids.length === 0}
                  disabled={formData.product_ids.length > 0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_expected_close_date">Previsão de Fechamento</Label>
                <Input
                  id="edit_expected_close_date"
                  type="date"
                  value={formData.expected_close_date}
                  onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                Salvar Alterações
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta oportunidade? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Convert to Sale Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transformar em Venda</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Você está prestes a converter esta oportunidade em uma venda confirmada.
            </p>
            <div className="space-y-2">
              <Label htmlFor="payment_method_1">Forma de Pagamento 1 *</Label>
              <Select
                value={paymentData.payment_method_1}
                onValueChange={(value) => setPaymentData({ ...paymentData, payment_method_1: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                  <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment_method_2">Forma de Pagamento 2 (Opcional)</Label>
              <Select
                value={paymentData.payment_method_2 || 'none'}
                onValueChange={(value) => setPaymentData({ 
                  ...paymentData, 
                  payment_method_2: value === 'none' ? '' : value 
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                  <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setConvertDialogOpen(false)} 
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleConfirmConvertToSale} 
                className="flex-1"
                disabled={!paymentData.payment_method_1}
              >
                Confirmar Venda
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
