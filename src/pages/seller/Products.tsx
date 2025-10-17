import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Eye, ShoppingCart, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  sku: string | null;
  price: number;
  cost: number;
  stock: number;
  status: string;
  image_url: string | null;
  max_discount_percent: number;
}

interface Client {
  id: string;
  farm_name: string;
  contact_name: string;
}

export default function SellerProducts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<{productId: string, qty: number, discount: number}[]>([]);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [saleDialogOpen, setSaleDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [saleStatus, setSaleStatus] = useState<'closed' | 'canceled'>('closed');
  const [taxPercent, setTaxPercent] = useState('0');
  const [region, setRegion] = useState('');
  const [paymentMethod1, setPaymentMethod1] = useState('');
  const [paymentMethod2, setPaymentMethod2] = useState('');
  const [paymentReceived, setPaymentReceived] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchClients();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, description, category, sku, price, cost, stock, status, image_url, max_discount_percent')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, farm_name, contact_name')
        .or(`seller_auth_id.eq.${user?.id},owner_user_id.eq.${user?.id}`)
        .order('farm_name');

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setViewDialogOpen(true);
  };

  const handleToggleProductSelection = (productId: string) => {
    setSelectedProducts(prev => {
      const exists = prev.find(p => p.productId === productId);
      if (exists) {
        return prev.filter(p => p.productId !== productId);
      } else {
        return [...prev, { productId, qty: 1, discount: 0 }];
      }
    });
  };

  const updateProductQty = (productId: string, qty: number) => {
    setSelectedProducts(prev => 
      prev.map(p => p.productId === productId ? { ...p, qty: Math.max(1, qty) } : p)
    );
  };

  const updateProductDiscount = (productId: string, discount: number) => {
    const product = products.find(p => p.id === productId);
    const maxDiscount = product?.max_discount_percent || 0;
    setSelectedProducts(prev => 
      prev.map(p => p.productId === productId ? { ...p, discount: Math.min(Math.max(0, discount), maxDiscount) } : p)
    );
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts(prev => prev.filter(p => p.productId !== productId));
  };

  const calculateTotals = () => {
    let grossValue = 0;
    let totalCost = 0;

    selectedProducts.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        const itemGross = product.price * item.qty * (1 - item.discount / 100);
        const itemCost = product.cost * item.qty;
        grossValue += itemGross;
        totalCost += itemCost;
      }
    });

    const estimatedProfit = grossValue - totalCost;
    return { grossValue, totalCost, estimatedProfit };
  };

  const handleOpenSaleDialog = () => {
    if (selectedProducts.length === 0) {
      toast.error('Selecione pelo menos um produto');
      return;
    }
    setSaleDialogOpen(true);
  };

  const handleCreateSale = async () => {
    if (!selectedClient) {
      toast.error('Selecione um cliente');
      return;
    }

    if (selectedProducts.length === 0) {
      toast.error('Adicione pelo menos um produto');
      return;
    }

    try {
      const totals = calculateTotals();
      
      const { data: saleData, error: saleError } = await supabase
        .from('sales')
        .insert([{
          client_id: selectedClient,
          seller_auth_id: user?.id,
          sold_at: new Date(saleDate).toISOString(),
          status: saleStatus,
          gross_value: totals.grossValue,
          total_cost: totals.totalCost,
          estimated_profit: totals.estimatedProfit,
          tax_percent: parseFloat(taxPercent) || 0,
          region: region || null,
          payment_method_1: paymentMethod1 || null,
          payment_method_2: paymentMethod2 || null,
          payment_received: paymentReceived,
        }])
        .select()
        .single();

      if (saleError) throw saleError;

      const saleItems = selectedProducts.map(item => {
        const product = products.find(p => p.id === item.productId);
        return {
          sale_id: saleData.id,
          product_id: item.productId,
          qty: item.qty,
          unit_price: product?.price || 0,
          discount_percent: item.discount,
        };
      });

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      toast.success('Venda criada com sucesso!');
      setSaleDialogOpen(false);
      setSelectedProducts([]);
      setSelectedClient('');
      setSaleDate(new Date().toISOString().split('T')[0]);
      setSaleStatus('closed');
      setTaxPercent('0');
      setRegion('');
      setPaymentMethod1('');
      setPaymentMethod2('');
      setPaymentReceived(false);
      
      navigate('/seller/sales');
    } catch (error: any) {
      console.error('Error creating sale:', error);
      toast.error('Erro ao criar venda');
    }
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Produtos</h1>
            <p className="text-muted-foreground">Catálogo de produtos disponíveis</p>
          </div>
          {selectedProducts.length > 0 && (
            <Button onClick={handleOpenSaleDialog} className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Gerar Venda ({selectedProducts.length})
            </Button>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {selectedProduct && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle>Informações do Produto</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedProduct(null)}
                >
                  Limpar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedProduct.image_url && (
                <div className="w-full h-40 overflow-hidden bg-muted rounded-lg">
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Nome</Label>
                  <p className="text-sm mt-1">{selectedProduct.name}</p>
                </div>
                {selectedProduct.category && (
                  <div>
                    <Label>Categoria</Label>
                    <p className="text-sm mt-1">{selectedProduct.category}</p>
                  </div>
                )}
                {selectedProduct.sku && (
                  <div>
                    <Label>SKU</Label>
                    <p className="text-sm mt-1">{selectedProduct.sku}</p>
                  </div>
                )}
                <div>
                  <Label>Estoque</Label>
                  <p className="text-sm mt-1">{selectedProduct.stock} unidades</p>
                </div>
                <div>
                  <Label>Preço de Venda</Label>
                  <p className="text-lg font-bold text-primary mt-1">
                    R$ {selectedProduct.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              {selectedProduct.description && (
                <div>
                  <Label>Descrição</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{selectedProduct.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {searchTerm ? 'Nenhum produto encontrado.' : 'Nenhum produto disponível.'}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => {
              const isSelected = selectedProducts.some(p => p.productId === product.id);
              return (
                <Card 
                  key={product.id} 
                  className={`overflow-hidden cursor-pointer transition-all ${
                    isSelected ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => {
                    handleToggleProductSelection(product.id);
                    setSelectedProduct(product);
                  }}
                >
                  {product.image_url && (
                    <div className="aspect-video w-full overflow-hidden bg-muted relative">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                      {isSelected && (
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      {product.category && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Categoria:</span>
                          <span className="font-medium">{product.category}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Estoque:</span>
                        <span className="font-medium">{product.stock} un</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-sm font-medium">Preço de Venda:</span>
                        <span className="text-lg font-bold text-primary">
                          R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewProduct(product);
                      }}
                    >
                      <Eye className="h-4 w-4" />
                      Visualizar Detalhes
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Dialog de Visualização */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes do Produto</DialogTitle>
            </DialogHeader>
            {selectedProduct && (
              <div className="space-y-4">
                {selectedProduct.image_url && (
                  <div className="w-full h-48 overflow-hidden bg-muted rounded-lg">
                    <img
                      src={selectedProduct.image_url}
                      alt={selectedProduct.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div>
                  <Label>Nome</Label>
                  <p className="text-sm mt-1">{selectedProduct.name}</p>
                </div>
                {selectedProduct.category && (
                  <div>
                    <Label>Categoria</Label>
                    <p className="text-sm mt-1">{selectedProduct.category}</p>
                  </div>
                )}
                {selectedProduct.sku && (
                  <div>
                    <Label>SKU</Label>
                    <p className="text-sm mt-1">{selectedProduct.sku}</p>
                  </div>
                )}
                <div>
                  <Label>Estoque</Label>
                  <p className="text-sm mt-1">{selectedProduct.stock} unidades</p>
                </div>
                <div>
                  <Label>Preço de Venda</Label>
                  <p className="text-lg font-bold text-primary mt-1">
                    R$ {selectedProduct.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                {selectedProduct.description && (
                  <div>
                    <Label>Descrição</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{selectedProduct.description}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de Criar Venda */}
        <Dialog open={saleDialogOpen} onOpenChange={setSaleDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Gerar Venda</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Informações da Venda */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <Select value={selectedClient} onValueChange={setSelectedClient}>
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
                  <Label>Data da Venda *</Label>
                  <Input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status *</Label>
                  <Select value={saleStatus} onValueChange={(value: 'closed' | 'canceled') => setSaleStatus(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="closed">Fechada</SelectItem>
                      <SelectItem value="canceled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Impostos (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(e.target.value)}
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Região</Label>
                  <Input
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="Ex: Norte, Sul, Centro"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Forma de Pagamento 1</Label>
                  <Select value={paymentMethod1} onValueChange={setPaymentMethod1}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
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
                  <Label>Forma de Pagamento 2 (Opcional)</Label>
                  <Select value={paymentMethod2} onValueChange={setPaymentMethod2}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
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

                <div className="flex items-center space-x-2 md:col-span-2">
                  <input
                    type="checkbox"
                    id="paymentReceived"
                    checked={paymentReceived}
                    onChange={(e) => setPaymentReceived(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <Label htmlFor="paymentReceived" className="cursor-pointer">
                    Pagamento Recebido
                  </Label>
                </div>
              </div>

              {/* Tabela de Produtos */}
              <div className="space-y-2">
                <Label>Produtos Selecionados</Label>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-2 text-sm font-medium">Produto</th>
                        <th className="text-center p-2 text-sm font-medium w-24">Qtd</th>
                        <th className="text-right p-2 text-sm font-medium">Preço Un.</th>
                        <th className="text-center p-2 text-sm font-medium w-24">Desc. %</th>
                        <th className="text-right p-2 text-sm font-medium">Total</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProducts.map((item) => {
                        const product = products.find(p => p.id === item.productId);
                        if (!product) return null;
                        const itemTotal = product.price * item.qty * (1 - item.discount / 100);
                        return (
                          <tr key={item.productId} className="border-t">
                            <td className="p-2 text-sm">{product.name}</td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min="1"
                                value={item.qty}
                                onChange={(e) => updateProductQty(item.productId, parseInt(e.target.value) || 1)}
                                className="w-20 text-center"
                              />
                            </td>
                            <td className="p-2 text-sm text-right">
                              R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min="0"
                                max={product.max_discount_percent}
                                step="0.1"
                                value={item.discount}
                                onChange={(e) => updateProductDiscount(item.productId, parseFloat(e.target.value) || 0)}
                                className="w-20 text-center"
                              />
                            </td>
                            <td className="p-2 text-sm text-right font-medium">
                              R$ {itemTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeProduct(item.productId)}
                                className="h-8 w-8 p-0"
                              >
                                ×
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totais */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valor Bruto:</span>
                  <span className="font-medium">R$ {calculateTotals().grossValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custo Total:</span>
                  <span className="font-medium">R$ {calculateTotals().totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t pt-2">
                  <span>Lucro Estimado:</span>
                  <span className="text-primary">R$ {calculateTotals().estimatedProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setSaleDialogOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button onClick={handleCreateSale} className="flex-1">
                  Criar Venda
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
