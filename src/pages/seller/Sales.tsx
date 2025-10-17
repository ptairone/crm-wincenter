import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, DollarSign, TrendingUp, ShoppingCart, Trash2, User, CheckCircle2, Clock } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ClientAutocomplete } from '@/components/ClientAutocomplete';

interface Sale {
  id: string;
  sold_at: string;
  gross_value: number;
  estimated_profit: number;
  total_cost: number;
  status: string;
  tax_percent: number;
  region: string;
  client_id: string;
  payment_received: boolean;
  payment_method_1: string | null;
  payment_method_2: string | null;
  service_id: string | null;
  clients?: {
    farm_name: string;
    contact_name: string;
  };
}

interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  max_discount_percent: number;
}

interface SaleItem {
  product_id: string;
  product_name: string;
  qty: number;
  unit_price: number;
  cost: number;
  discount_percent: number;
  max_discount: number;
}

interface Seller {
  id: string;
  auth_user_id: string;
  name: string;
}

export default function Sales() {
  const { user, userRole } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemDiscount, setItemDiscount] = useState('0');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'received' | 'pending'>('all');
  const [formData, setFormData] = useState({
    client_id: '',
    seller_auth_id: user?.id || '',
    sold_at: new Date().toISOString().split('T')[0],
    status: 'closed',
    tax_percent: '',
    region: '',
    payment_method_1: '',
    payment_method_2: '',
    payment_received: false,
  });

  useEffect(() => {
    fetchSales();
    fetchClients();
    fetchProducts();
    if (userRole === 'admin') {
      fetchSellers();
    }
  }, [user, userRole]);

  const fetchClients = async () => {
    try {
      let query = supabase.from('clients').select('id, farm_name, contact_name');
      
      // Admin e técnicos veem todos os clientes
      // Sellers veem apenas seus clientes ou clientes que eles criaram (owner_user_id)
      if (userRole === 'seller' && user?.id) {
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
        .select('id, name, price, cost, max_discount_percent')
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
        .in('role', ['seller', 'admin'])
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

      if (userRole === 'seller' || userRole === 'technician') {
        query = query.eq('seller_auth_id', user?.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSales(data || []);
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

  const handleTogglePayment = async (saleId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('sales')
        .update({ payment_received: !currentStatus })
        .eq('id', saleId);

      if (error) throw error;

      toast.success(currentStatus ? 'Pagamento marcado como pendente' : 'Pagamento confirmado!');
      fetchSales();
    } catch (error) {
      console.error('Error updating payment status:', error);
      toast.error('Erro ao atualizar status de pagamento');
    }
  };

  const handleAddProduct = () => {
    if (!selectedProduct || !itemQty) {
      toast.error('Selecione um produto e informe a quantidade');
      return;
    }

    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    const discount = Number(itemDiscount) || 0;
    if (discount > product.max_discount_percent) {
      toast.error(`Desconto máximo permitido: ${product.max_discount_percent}%`);
      return;
    }

    const newItem: SaleItem = {
      product_id: product.id,
      product_name: product.name,
      qty: Number(itemQty),
      unit_price: product.price,
      cost: product.cost,
      discount_percent: discount,
      max_discount: product.max_discount_percent,
    };

    setSaleItems([...saleItems, newItem]);
    setSelectedProduct('');
    setItemQty('1');
    setItemDiscount('0');
  };

  const handleRemoveProduct = (index: number) => {
    setSaleItems(saleItems.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    let totalGross = 0;
    let totalCost = 0;

    saleItems.forEach(item => {
      const itemGross = item.unit_price * item.qty * (1 - item.discount_percent / 100);
      const itemCost = item.cost * item.qty;
      totalGross += itemGross;
      totalCost += itemCost;
    });

    return {
      gross: totalGross,
      cost: totalCost,
      profit: totalGross - totalCost
    };
  };

  const totals = calculateTotals();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (saleItems.length === 0) {
      toast.error('Adicione pelo menos um produto à venda');
      return;
    }

    if (totals.gross <= 0) {
      toast.error('O valor total da venda não pode ser zero');
      return;
    }

    try {
      // Criar a venda
      const saleData: any = {
        client_id: formData.client_id,
        seller_auth_id: formData.seller_auth_id || user?.id,
        sold_at: new Date(formData.sold_at).toISOString(),
        status: formData.status,
        tax_percent: formData.tax_percent ? Number(formData.tax_percent) : null,
        region: formData.region || null,
        gross_value: Number(totals.gross),
        total_cost: Number(totals.cost),
        estimated_profit: Number(totals.profit),
        payment_method_1: formData.payment_method_1 || null,
        payment_method_2: formData.payment_method_2 || null,
        payment_received: formData.payment_received,
      };

      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert([saleData])
        .select()
        .single();

      if (saleError) throw saleError;

      // Criar os itens da venda
      const itemsData = saleItems.map(item => ({
        sale_id: sale.id,
        product_id: item.product_id,
        qty: item.qty,
        unit_price: item.unit_price,
        discount_percent: item.discount_percent,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(itemsData);

      if (itemsError) throw itemsError;

      toast.success('Venda criada com sucesso!');
      setDialogOpen(false);
      setFormData({
        client_id: '',
        seller_auth_id: user?.id || '',
        sold_at: new Date().toISOString().split('T')[0],
        status: 'closed',
        tax_percent: '',
        region: '',
        payment_method_1: '',
        payment_method_2: '',
        payment_received: false,
      });
      setSaleItems([]);
      fetchSales();
    } catch (error: any) {
      console.error('Error creating sale:', error);
      toast.error('Erro ao criar venda: ' + error.message);
    }
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

  // Cálculos de recebimento
  const receivedSales = sales.filter(s => s.status === 'closed' && s.payment_received);
  const pendingSales = sales.filter(s => s.status === 'closed' && !s.payment_received);
  
  const totalReceived = receivedSales.reduce((sum, s) => sum + Number(s.gross_value), 0);
  const totalPending = pendingSales.reduce((sum, s) => sum + Number(s.gross_value), 0);

  // Aplicar filtro de pagamento
  const filteredSales = sales.filter(sale => {
    if (paymentFilter === 'received') return sale.payment_received;
    if (paymentFilter === 'pending') return !sale.payment_received;
    return true;
  });

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
            <h1 className="text-3xl font-bold">Vendas</h1>
            <p className="text-muted-foreground">Histórico e gestão de vendas</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Venda
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Registrar Nova Venda</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                  {userRole === 'admin' && (
                    <div className="space-y-2">
                      <Label htmlFor="seller_auth_id">Vendedor *</Label>
                      <Select
                        value={formData.seller_auth_id}
                        onValueChange={(value) => setFormData({ ...formData, seller_auth_id: value })}
                        required
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Selecione um vendedor" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-[100]">
                          {sellers.map((seller) => (
                            <SelectItem key={seller.auth_user_id} value={seller.auth_user_id}>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                {seller.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sold_at">Data da Venda *</Label>
                    <Input
                      id="sold_at"
                      type="date"
                      value={formData.sold_at}
                      onChange={(e) => setFormData({ ...formData, sold_at: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-[100]">
                        <SelectItem value="closed">Fechada</SelectItem>
                        <SelectItem value="canceled">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tax_percent">Impostos (%)</Label>
                    <Input
                      id="tax_percent"
                      type="number"
                      step="0.01"
                      value={formData.tax_percent}
                      onChange={(e) => setFormData({ ...formData, tax_percent: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="region">Região</Label>
                    <Input
                      id="region"
                      value={formData.region}
                      onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    />
                  </div>
                </div>

                {/* Formas de Pagamento */}
                <div className="border-t pt-4 space-y-4">
                  <h3 className="font-semibold">Forma de Pagamento</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="payment_method_1">Forma de Pagamento 1</Label>
                      <Select
                        value={formData.payment_method_1}
                        onValueChange={(value) => setFormData({ ...formData, payment_method_1: value })}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-[100]">
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="pix">Pix</SelectItem>
                          <SelectItem value="financiamento">Financiamento</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                          <SelectItem value="troca">Troca</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="payment_method_2">Forma de Pagamento 2 (Opcional)</Label>
                      <Select
                        value={formData.payment_method_2}
                        onValueChange={(value) => setFormData({ ...formData, payment_method_2: value })}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-[100]">
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="pix">Pix</SelectItem>
                          <SelectItem value="financiamento">Financiamento</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                          <SelectItem value="troca">Troca</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="payment_received"
                      checked={formData.payment_received}
                      onChange={(e) => setFormData({ ...formData, payment_received: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="payment_received" className="cursor-pointer">
                      Pagamento Recebido
                    </Label>
                  </div>
                </div>

                {/* Adicionar Produtos */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Produtos da Venda *</h3>
                  <div className="grid grid-cols-12 gap-2 mb-3">
                    <div className="col-span-5 space-y-2">
                      <Label>Produto</Label>
                      <Select
                        value={selectedProduct}
                        onValueChange={setSelectedProduct}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Selecione um produto" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-[100]">
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
                    <div className="col-span-2 space-y-2">
                      <Label>Quantidade</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="1"
                        value={itemQty}
                        onChange={(e) => setItemQty(e.target.value)}
                      />
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Desconto (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0"
                        value={itemDiscount}
                        onChange={(e) => setItemDiscount(e.target.value)}
                      />
                    </div>
                    <div className="col-span-3 space-y-2">
                      <Label className="opacity-0">Ação</Label>
                      <Button
                        type="button"
                        onClick={handleAddProduct}
                        className="w-full"
                        variant="outline"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                  </div>

                  {/* Lista de Produtos Adicionados */}
                  {saleItems.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead className="text-right">Qtd</TableHead>
                            <TableHead className="text-right">Preço Un.</TableHead>
                            <TableHead className="text-right">Desc %</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {saleItems.map((item, index) => {
                            const itemTotal = item.unit_price * item.qty * (1 - item.discount_percent / 100);
                            return (
                              <TableRow key={index}>
                                <TableCell className="font-medium">{item.product_name}</TableCell>
                                <TableCell className="text-right">{item.qty}</TableCell>
                                <TableCell className="text-right">
                                  {new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  }).format(item.unit_price)}
                                </TableCell>
                                <TableCell className="text-right">{item.discount_percent}%</TableCell>
                                <TableCell className="text-right font-medium">
                                  {new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL',
                                  }).format(itemTotal)}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveProduct(index)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Totais */}
                  {saleItems.length > 0 && (
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Valor Bruto:</span>
                        <span className="font-medium">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(totals.gross)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Custo Total:</span>
                        <span className="font-medium text-red-600">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(totals.cost)}
                        </span>
                      </div>
                      <div className="flex justify-between text-lg font-bold border-t pt-2">
                        <span>Lucro Estimado:</span>
                        <span className="text-green-600">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(totals.profit)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={saleItems.length === 0}>
                  Criar Venda
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Vendas do Mês</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{monthSales.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  notation: 'compact',
                }).format(monthRevenue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  notation: 'compact',
                }).format(totalRevenue)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {sales.filter(s => s.status === 'closed').length} vendas fechadas
              </p>
            </CardContent>
          </Card>
          {userRole === 'admin' && (
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium">Lucro Total</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                    notation: 'compact',
                  }).format(totalProfit)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Margem: {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0}%
                </p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  notation: 'compact',
                }).format(
                  sales.filter(s => s.status === 'closed').length > 0
                    ? totalRevenue / sales.filter(s => s.status === 'closed').length
                    : 0
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cards de Recebimento - apenas admin */}
        {userRole === 'admin' && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium">Recebido</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(totalReceived)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {receivedSales.length} vendas recebidas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium">A Receber</CardTitle>
                <Clock className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(totalPending)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {pendingSales.length} vendas pendentes
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-medium">Taxa de Recebimento</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {sales.filter(s => s.status === 'closed').length > 0
                    ? ((receivedSales.length / sales.filter(s => s.status === 'closed').length) * 100).toFixed(1)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Do total de vendas
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Histórico de Vendas</CardTitle>
              {userRole === 'admin' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={paymentFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setPaymentFilter('all')}
                  >
                    Todas
                  </Button>
                  <Button
                    size="sm"
                    variant={paymentFilter === 'received' ? 'default' : 'outline'}
                    onClick={() => setPaymentFilter('received')}
                  >
                    Recebidas
                  </Button>
                  <Button
                    size="sm"
                    variant={paymentFilter === 'pending' ? 'default' : 'outline'}
                    onClick={() => setPaymentFilter('pending')}
                  >
                    Pendentes
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
               <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor Bruto</TableHead>
                  {userRole === 'admin' && (
                    <>
                      <TableHead>Custo</TableHead>
                      <TableHead>Lucro</TableHead>
                      <TableHead>Margem</TableHead>
                      <TableHead>Pagamento</TableHead>
                    </>
                  )}
                  <TableHead>Status</TableHead>
                  {userRole === 'admin' && <TableHead>Ação</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={userRole === 'admin' ? 9 : 4} className="text-center py-8 text-muted-foreground">
                      Nenhuma venda encontrada
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSales.map((sale) => {
                    const statusInfo = getStatusInfo(sale.status);
                    const margin = sale.gross_value > 0
                      ? ((sale.estimated_profit / sale.gross_value) * 100).toFixed(1)
                      : 0;

                    return (
                      <TableRow key={sale.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          {new Date(sale.sold_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {sale.clients?.farm_name || 'Cliente não informado'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {sale.clients?.contact_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(sale.gross_value)}
                        </TableCell>
                        {userRole === 'admin' && (
                          <>
                            <TableCell className="text-red-600">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(sale.total_cost)}
                            </TableCell>
                            <TableCell className="text-green-600 font-medium">
                              {new Intl.NumberFormat('pt-BR', {
                                style: 'currency',
                                currency: 'BRL',
                              }).format(sale.estimated_profit)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{margin}%</Badge>
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
                          </>
                        )}
                        <TableCell>
                          <Badge className={statusInfo.color}>
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        {userRole === 'admin' && (
                          <TableCell>
                            <Button
                              size="sm"
                              variant={sale.payment_received ? 'outline' : 'default'}
                              onClick={() => handleTogglePayment(sale.id, sale.payment_received)}
                            >
                              {sale.payment_received ? 'Marcar Pendente' : 'Confirmar Recebimento'}
                            </Button>
                          </TableCell>
                        )}
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
