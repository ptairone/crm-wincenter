import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Package, AlertTriangle, Upload, X, Pencil, History, Calculator } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { productSchema } from '@/lib/validation';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  description: string;
  cost: number;
  price: number;
  stock: number;
  low_stock_threshold: number;
  max_discount_percent: number;
  status: string;
  image_url?: string | null;
  profit_margin_percent: number;
  tax_percent: number;
  pricing_mode: 'manual' | 'calculated';
}

interface PriceHistory {
  id: string;
  product_id: string;
  change_type: string;
  old_cost: number | null;
  new_cost: number | null;
  old_price: number | null;
  new_price: number | null;
  profit_margin_percent: number | null;
  tax_percent: number | null;
  notes: string | null;
  created_at: string;
}

interface StockMovement {
  id: string;
  type: 'sale' | 'price_change';
  created_at: string;
  // Para vendas
  sale_id?: string;
  qty?: number;
  unit_price?: number;
  client_name?: string;
  // Para mudanças de preço
  change_type?: string;
  old_cost?: number | null;
  new_cost?: number | null;
  old_price?: number | null;
  new_price?: number | null;
  profit_margin_percent?: number | null;
  tax_percent?: number | null;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    description: '',
    cost: '',
    price: '',
    stock: '',
    low_stock_threshold: '',
    max_discount_percent: '',
    status: 'active',
    profit_margin_percent: '',
    tax_percent: '',
    pricing_mode: 'manual' as 'manual' | 'calculated',
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name');

      if (error) throw error;
      setProducts((data || []).map(p => ({
        ...p,
        pricing_mode: (p.pricing_mode || 'manual') as 'manual' | 'calculated',
      })) as Product[]);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: 'Ativo',
      inactive: 'Inativo',
    };
    return labels[status] || status;
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('A imagem deve ter no máximo 5MB');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const calculatePrice = (cost: number, margin: number, tax: number): number => {
    // Preço = Custo / (1 - (Margem% + Imposto%)/100)
    const totalPercent = margin + tax;
    if (totalPercent >= 100) return cost; // Evitar divisão por zero ou negativo
    return cost / (1 - totalPercent / 100);
  };

  const handleCostChange = (value: string) => {
    setFormData({ ...formData, cost: value });
    if (formData.pricing_mode === 'calculated' && value) {
      const cost = Number(value);
      const margin = Number(formData.profit_margin_percent) || 0;
      const tax = Number(formData.tax_percent) || 0;
      const calculatedPrice = calculatePrice(cost, margin, tax);
      setFormData(prev => ({ ...prev, cost: value, price: calculatedPrice.toFixed(2) }));
    }
  };

  const handleMarginChange = (value: string) => {
    setFormData({ ...formData, profit_margin_percent: value });
    if (formData.pricing_mode === 'calculated' && formData.cost) {
      const cost = Number(formData.cost);
      const margin = Number(value) || 0;
      const tax = Number(formData.tax_percent) || 0;
      const calculatedPrice = calculatePrice(cost, margin, tax);
      setFormData(prev => ({ ...prev, profit_margin_percent: value, price: calculatedPrice.toFixed(2) }));
    }
  };

  const handleTaxChange = (value: string) => {
    setFormData({ ...formData, tax_percent: value });
    if (formData.pricing_mode === 'calculated' && formData.cost) {
      const cost = Number(formData.cost);
      const margin = Number(formData.profit_margin_percent) || 0;
      const tax = Number(value) || 0;
      const calculatedPrice = calculatePrice(cost, margin, tax);
      setFormData(prev => ({ ...prev, tax_percent: value, price: calculatedPrice.toFixed(2) }));
    }
  };

  const handlePricingModeChange = (mode: 'manual' | 'calculated') => {
    setFormData({ ...formData, pricing_mode: mode });
    if (mode === 'calculated' && formData.cost) {
      const cost = Number(formData.cost);
      const margin = Number(formData.profit_margin_percent) || 0;
      const tax = Number(formData.tax_percent) || 0;
      const calculatedPrice = calculatePrice(cost, margin, tax);
      setFormData(prev => ({ ...prev, pricing_mode: mode, price: calculatedPrice.toFixed(2) }));
    }
  };

  const saveToHistory = async (productId: string, oldProduct: Product | null, newData: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      let changeType = 'both';
      if (oldProduct) {
        const costChanged = oldProduct.cost !== Number(newData.cost);
        const priceChanged = oldProduct.price !== Number(newData.price);
        
        if (costChanged && !priceChanged) changeType = 'cost';
        else if (!costChanged && priceChanged) changeType = 'price';
        else if (!costChanged && !priceChanged) return; // Nada mudou
      }

      await supabase.from('product_price_history').insert([{
        product_id: productId,
        changed_by: user?.id,
        change_type: changeType,
        old_cost: oldProduct?.cost || null,
        new_cost: Number(newData.cost),
        old_price: oldProduct?.price || null,
        new_price: Number(newData.price),
        profit_margin_percent: Number(newData.profit_margin_percent) || null,
        tax_percent: Number(newData.tax_percent) || null,
      }]);
    } catch (error) {
      console.error('Error saving price history:', error);
    }
  };

  const fetchPriceHistory = async (productId: string) => {
    try {
      // Buscar histórico de preços
      const { data: priceData, error: priceError } = await supabase
        .from('product_price_history')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (priceError) throw priceError;

      // Buscar vendas deste produto
      const { data: salesData, error: salesError } = await supabase
        .from('sale_items')
        .select(`
          id,
          qty,
          unit_price,
          sale_id,
          sales!inner(
            created_at,
            status,
            client_id,
            clients!inner(contact_name)
          )
        `)
        .eq('product_id', productId)
        .eq('sales.status', 'closed')
        .order('sales.created_at', { ascending: false })
        .limit(20);

      if (salesError) throw salesError;

      // Combinar e formatar os dados
      const priceMovements: StockMovement[] = (priceData || []).map(entry => ({
        id: entry.id,
        type: 'price_change' as const,
        created_at: entry.created_at,
        change_type: entry.change_type,
        old_cost: entry.old_cost,
        new_cost: entry.new_cost,
        old_price: entry.old_price,
        new_price: entry.new_price,
        profit_margin_percent: entry.profit_margin_percent,
        tax_percent: entry.tax_percent,
      }));

      const saleMovements: StockMovement[] = (salesData || []).map((item: any) => ({
        id: item.id,
        type: 'sale' as const,
        created_at: item.sales.created_at,
        sale_id: item.sale_id,
        qty: item.qty,
        unit_price: item.unit_price,
        client_name: item.sales.clients?.contact_name || 'Cliente não identificado',
      }));

      // Combinar e ordenar por data
      const allMovements = [...priceMovements, ...saleMovements].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setPriceHistory(priceData || []);
      setStockMovements(allMovements);
      setShowHistory(true);
    } catch (error) {
      console.error('Error fetching price history:', error);
      toast.error('Erro ao buscar histórico');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    
    try {
      // Validar dados do formulário
      const validationData = {
        name: formData.name,
        sku: formData.sku || undefined,
        category: formData.category || undefined,
        description: formData.description || undefined,
        cost: Number(formData.cost),
        price: Number(formData.price),
        stock: Number(formData.stock),
        low_stock_threshold: Number(formData.low_stock_threshold) || 0,
        max_discount_percent: Number(formData.max_discount_percent) || 0,
        profit_margin_percent: Number(formData.profit_margin_percent) || 0,
        tax_percent: Number(formData.tax_percent) || 0,
      };

      const validation = productSchema.safeParse(validationData);
      
      if (!validation.success) {
        const firstError = validation.error.errors[0];
        toast.error(firstError.message);
        setUploading(false);
        return;
      }

      let imageUrl: string | null = editingProduct?.image_url || null;
      
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
        if (!imageUrl) {
          toast.error('Erro ao fazer upload da imagem');
          setUploading(false);
          return;
        }
      }

      const productData: any = {
        name: formData.name,
        sku: formData.sku || null,
        category: formData.category || null,
        description: formData.description || null,
        cost: Number(formData.cost),
        price: Number(formData.price),
        stock: Number(formData.stock),
        low_stock_threshold: Number(formData.low_stock_threshold) || 0,
        max_discount_percent: Number(formData.max_discount_percent) || 0,
        status: formData.status,
        image_url: imageUrl,
        profit_margin_percent: Number(formData.profit_margin_percent) || 0,
        tax_percent: Number(formData.tax_percent) || 0,
        pricing_mode: formData.pricing_mode,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;
        
        // Salvar histórico se preço ou custo mudaram
        await saveToHistory(editingProduct.id, editingProduct, productData);
        
        toast.success('Produto atualizado com sucesso!');
      } else {
        const { data: newProduct, error } = await supabase
          .from('products')
          .insert([productData])
          .select()
          .maybeSingle();

        if (error) throw error;
        
        // Salvar histórico inicial apenas após sucesso
        if (newProduct) {
          await saveToHistory(newProduct.id, null, productData);
        }
        
        toast.success('Produto criado com sucesso!');
      }

      setDialogOpen(false);
      setEditingProduct(null);
      setFormData({
        name: '',
        sku: '',
        category: '',
        description: '',
        cost: '',
        price: '',
        stock: '',
        low_stock_threshold: '',
        max_discount_percent: '',
        status: 'active',
        profit_margin_percent: '',
        tax_percent: '',
        pricing_mode: 'manual',
      });
      removeImage();
      fetchProducts();
    } catch (error: any) {
      console.error('Error saving product:', error);
      toast.error(error.message || 'Erro ao salvar produto');
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      sku: product.sku || '',
      category: product.category || '',
      description: product.description || '',
      cost: product.cost.toString(),
      price: product.price.toString(),
      stock: product.stock.toString(),
      low_stock_threshold: product.low_stock_threshold.toString(),
      max_discount_percent: product.max_discount_percent.toString(),
      status: product.status,
      profit_margin_percent: (product.profit_margin_percent || 0).toString(),
      tax_percent: (product.tax_percent || 0).toString(),
      pricing_mode: product.pricing_mode || 'manual',
    });
    setImagePreview(product.image_url || null);
    setShowHistory(false);
    setDialogOpen(true);
  };

  const activeProducts = products.filter(p => p.status === 'active');
  const lowStockProducts = products.filter(p => p.stock <= p.low_stock_threshold && p.status === 'active');
  const totalValue = products.reduce((sum, p) => sum + (p.cost * p.stock), 0);

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
            <h1 className="text-3xl font-bold">Produtos</h1>
            <p className="text-muted-foreground">Gerencie o catálogo e estoque</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingProduct(null);
              setFormData({
                name: '',
                sku: '',
                category: '',
                description: '',
                cost: '',
                price: '',
                stock: '',
                low_stock_threshold: '',
                max_discount_percent: '',
                status: 'active',
                profit_margin_percent: '',
                tax_percent: '',
                pricing_mode: 'manual',
              });
              removeImage();
              setShowHistory(false);
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProduct ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Foto do Produto</Label>
                  <div className="flex items-center gap-4">
                    {imagePreview ? (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-24 h-24 object-cover rounded-lg border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={removeImage}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 border-2 border-dashed rounded-lg flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                        id="image-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Escolher Imagem
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        PNG, JPG até 5MB
                      </p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input
                      id="sku"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>

                {/* Modo de Precificação */}
                <div className="space-y-2">
                  <Label>Modo de Precificação</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={formData.pricing_mode === 'manual' ? 'default' : 'outline'}
                      onClick={() => handlePricingModeChange('manual')}
                      className="flex-1"
                    >
                      Manual
                    </Button>
                    <Button
                      type="button"
                      variant={formData.pricing_mode === 'calculated' ? 'default' : 'outline'}
                      onClick={() => handlePricingModeChange('calculated')}
                      className="flex-1"
                    >
                      <Calculator className="mr-2 h-4 w-4" />
                      Calculado
                    </Button>
                  </div>
                </div>

                {/* Campos de Precificação */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cost">Custo (R$) *</Label>
                    <Input
                      id="cost"
                      type="number"
                      step="0.01"
                      value={formData.cost}
                      onChange={(e) => handleCostChange(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Preço de Venda (R$) *</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      disabled={formData.pricing_mode === 'calculated'}
                      required
                    />
                  </div>
                </div>

                {/* Margem e Impostos - visíveis no modo calculado */}
                {formData.pricing_mode === 'calculated' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="profit_margin">Margem de Lucro (%)</Label>
                      <Input
                        id="profit_margin"
                        type="number"
                        step="0.01"
                        value={formData.profit_margin_percent}
                        onChange={(e) => handleMarginChange(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tax">Impostos (%)</Label>
                      <Input
                        id="tax"
                        type="number"
                        step="0.01"
                        value={formData.tax_percent}
                        onChange={(e) => handleTaxChange(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        ICMS, PIS, COFINS, etc.
                      </p>
                    </div>
                  </div>
                )}

                {/* Mostrar cálculo em tempo real */}
                {formData.pricing_mode === 'calculated' && formData.cost && (
                  <div className="p-3 bg-muted rounded-lg space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Custo:</span>
                      <span className="font-medium">R$ {Number(formData.cost).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Margem ({formData.profit_margin_percent || 0}%):</span>
                      <span className="font-medium">R$ {(Number(formData.cost) * (Number(formData.profit_margin_percent) || 0) / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Impostos ({formData.tax_percent || 0}%):</span>
                      <span className="font-medium">R$ {(Number(formData.cost) * (Number(formData.tax_percent) || 0) / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t pt-1">
                      <span>Preço de Venda:</span>
                      <span className="text-primary">R$ {Number(formData.price).toFixed(2)}</span>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stock">Estoque Inicial *</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="low_stock_threshold">Estoque Mínimo</Label>
                    <Input
                      id="low_stock_threshold"
                      type="number"
                      value={formData.low_stock_threshold}
                      onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max_discount_percent">Desconto Máx. (%)</Label>
                    <Input
                      id="max_discount_percent"
                      type="number"
                      step="0.01"
                      value={formData.max_discount_percent}
                      onChange={(e) => setFormData({ ...formData, max_discount_percent: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  {editingProduct && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fetchPriceHistory(editingProduct.id)}
                      className="flex-1"
                    >
                      <History className="mr-2 h-4 w-4" />
                      Ver Histórico
                    </Button>
                  )}
                  <Button type="submit" className="flex-1" disabled={uploading}>
                    {uploading ? 'Salvando...' : (editingProduct ? 'Atualizar Produto' : 'Criar Produto')}
                  </Button>
                </div>
              </form>

              {/* Histórico de Alterações */}
              {showHistory && (
                <div className="mt-4 border-t pt-4">
                  <h3 className="font-semibold mb-3 flex items-center">
                    <History className="mr-2 h-4 w-4" />
                    Histórico de Alterações
                  </h3>
                  {stockMovements.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma alteração registrada ainda
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {stockMovements.map((entry) => (
                        <div key={entry.id} className="p-3 bg-muted rounded-lg text-sm">
                          <div className="flex justify-between items-start mb-1">
                            <Badge 
                              variant={entry.type === 'sale' ? 'default' : 'secondary'} 
                              className="text-xs"
                            >
                              {entry.type === 'sale' 
                                ? 'Venda Finalizada' 
                                : entry.change_type === 'cost' 
                                  ? 'Custo' 
                                  : entry.change_type === 'price' 
                                    ? 'Preço' 
                                    : 'Custo e Preço'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(entry.created_at).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {entry.type === 'sale' ? (
                              <>
                                <div className="text-xs">
                                  Saída de Estoque: <span className="font-medium">{entry.qty} unidades</span>
                                </div>
                                <div className="text-xs">
                                  Valor Unitário: <span className="font-medium">R$ {entry.unit_price?.toFixed(2)}</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Cliente: {entry.client_name}
                                </div>
                              </>
                            ) : (
                              <>
                                {entry.old_cost !== entry.new_cost && (
                                  <div className="text-xs">
                                    Custo: R$ {entry.old_cost?.toFixed(2) || '0.00'} → R$ {entry.new_cost?.toFixed(2) || '0.00'}
                                  </div>
                                )}
                                {entry.old_price !== entry.new_price && (
                                  <div className="text-xs">
                                    Preço: R$ {entry.old_price?.toFixed(2) || '0.00'} → R$ {entry.new_price?.toFixed(2) || '0.00'}
                                  </div>
                                )}
                                {entry.profit_margin_percent !== null && (
                                  <div className="text-xs text-muted-foreground">
                                    Margem: {entry.profit_margin_percent}% | Impostos: {entry.tax_percent || 0}%
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Total de Produtos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{products.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {activeProducts.length} ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Valor em Estoque</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(totalValue)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {lowStockProducts.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Produtos com estoque crítico
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Unidades em Estoque</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {products.reduce((sum, p) => sum + p.stock, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Catálogo de Produtos</CardTitle>
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produtos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Foto</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Margem</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nenhum produto encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => {
                    const margin = product.price > 0 ? ((product.price - product.cost) / product.price * 100) : 0;
                    const isLowStock = product.stock <= product.low_stock_threshold;

                    return (
                      <TableRow key={product.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={product.image_url || ''} alt={product.name} />
                            <AvatarFallback>
                              <Package className="h-6 w-6" />
                            </AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{product.name}</div>
                          {product.description && (
                            <div className="text-sm text-muted-foreground truncate max-w-xs">
                              {product.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {product.sku || '-'}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{product.category || 'Sem categoria'}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(product.cost)}
                        </TableCell>
                        <TableCell>
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          }).format(product.price)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={margin > 20 ? 'bg-green-50' : ''}>
                            {margin.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isLowStock && (
                              <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            )}
                            <span className={isLowStock ? 'text-yellow-600 font-medium' : ''}>
                              {product.stock}
                            </span>
                          </div>
                        </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(product.status)}>
                        {getStatusLabel(product.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(product)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
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
