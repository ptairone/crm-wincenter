import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Settings, Percent, Package, Edit, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface CommissionRule {
  id: string;
  base: string;
  percent: number;
  active: boolean;
  scope: string;
  category: string;
  product_id: string;
  created_at: string;
  products?: {
    name: string;
    sku: string;
  };
}

export default function CommissionRules() {
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<CommissionRule | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    base: 'gross',
    percent: '',
    scope: 'general',
    category: '',
    product_id: '',
    active: true,
  });

  useEffect(() => {
    fetchRules();
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, sku, category')
        .eq('status', 'active');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchRules = async () => {
    try {
      const { data, error } = await supabase
        .from('commission_rules')
        .select(`
          *,
          products (
            name,
            sku
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRules(data || []);
    } catch (error) {
      console.error('Error fetching commission rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRuleStatus = async (ruleId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('commission_rules')
        .update({ active: !currentStatus })
        .eq('id', ruleId);

      if (error) throw error;
      
      // Update local state
      setRules(rules.map(rule => 
        rule.id === ruleId ? { ...rule, active: !currentStatus } : rule
      ));
    } catch (error) {
      console.error('Error toggling rule status:', error);
    }
  };

  const getBaseInfo = (base: string) => {
    const bases: Record<string, { label: string; color: string }> = {
      gross: { label: 'Valor Bruto', color: 'bg-blue-100 text-blue-800' },
      profit: { label: 'Lucro', color: 'bg-green-100 text-green-800' },
      maintenance: { label: 'Manutenção', color: 'bg-cyan-100 text-cyan-800' },
      revision: { label: 'Revisão', color: 'bg-indigo-100 text-indigo-800' },
      spraying: { label: 'Pulverização', color: 'bg-teal-100 text-teal-800' },
    };
    return bases[base] || { label: base, color: 'bg-gray-100 text-gray-800' };
  };

  const getScopeInfo = (scope: string) => {
    const scopes: Record<string, { label: string; color: string }> = {
      general: { label: 'Geral', color: 'bg-purple-100 text-purple-800' },
      category: { label: 'Categoria', color: 'bg-yellow-100 text-yellow-800' },
      product: { label: 'Produto', color: 'bg-orange-100 text-orange-800' },
    };
    return scopes[scope] || { label: scope, color: 'bg-gray-100 text-gray-800' };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const ruleData: any = {
        base: formData.base,
        percent: Number(formData.percent),
        scope: formData.scope,
        active: formData.active,
        category: null,
        product_id: null,
      };

      if (formData.scope === 'category' && formData.category) {
        ruleData.category = formData.category;
      }

      if (formData.scope === 'product' && formData.product_id) {
        ruleData.product_id = formData.product_id;
      }

      const { error } = await supabase
        .from('commission_rules')
        .insert([ruleData]);

      if (error) throw error;

      toast.success('Regra de comissão criada com sucesso!');
      setDialogOpen(false);
      setFormData({
        base: 'gross',
        percent: '',
        scope: 'general',
        category: '',
        product_id: '',
        active: true,
      });
      fetchRules();
    } catch (error: any) {
      console.error('Error creating rule:', error);
      toast.error('Erro ao criar regra: ' + error.message);
    }
  };

  const handleEdit = (rule: CommissionRule) => {
    setSelectedRule(rule);
    setFormData({
      base: rule.base,
      percent: String(rule.percent),
      scope: rule.scope,
      category: rule.category || '',
      product_id: rule.product_id || '',
      active: rule.active,
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRule) return;

    try {
      const ruleData: any = {
        base: formData.base,
        percent: Number(formData.percent),
        scope: formData.scope,
        active: formData.active,
        category: null,
        product_id: null,
      };

      if (formData.scope === 'category' && formData.category) {
        ruleData.category = formData.category;
      }

      if (formData.scope === 'product' && formData.product_id) {
        ruleData.product_id = formData.product_id;
      }

      const { error } = await supabase
        .from('commission_rules')
        .update(ruleData)
        .eq('id', selectedRule.id);

      if (error) throw error;

      toast.success('Regra atualizada com sucesso!');
      setEditDialogOpen(false);
      setSelectedRule(null);
      fetchRules();
    } catch (error: any) {
      toast.error('Erro ao atualizar: ' + error.message);
    }
  };

  const handleDelete = async () => {
    if (!selectedRule) return;

    try {
      const { error } = await supabase
        .from('commission_rules')
        .delete()
        .eq('id', selectedRule.id);

      if (error) throw error;

      toast.success('Regra excluída!');
      setDeleteDialogOpen(false);
      setSelectedRule(null);
      fetchRules();
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
    }
  };

  const activeRules = rules.filter(r => r.active);
  const generalRules = rules.filter(r => r.scope === 'general');
  const categoryRules = rules.filter(r => r.scope === 'category');
  const productRules = rules.filter(r => r.scope === 'product');

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
            <h1 className="text-3xl font-bold">Regras de Comissão</h1>
            <p className="text-muted-foreground">Configure percentuais de comissão</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Regra
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Regra de Comissão</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="base">Base de Cálculo *</Label>
                  <Select
                    value={formData.base}
                    onValueChange={(value) => setFormData({ ...formData, base: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gross">Valor Bruto (Vendas)</SelectItem>
                      <SelectItem value="profit">Lucro (Vendas)</SelectItem>
                      <SelectItem value="maintenance">Manutenção (Serviços)</SelectItem>
                      <SelectItem value="revision">Revisão (Serviços)</SelectItem>
                      <SelectItem value="spraying">Pulverização (Serviços)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="percent">Percentual (%) *</Label>
                  <Input
                    id="percent"
                    type="number"
                    step="0.01"
                    value={formData.percent}
                    onChange={(e) => setFormData({ ...formData, percent: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scope">Escopo *</Label>
                  <Select
                    value={formData.scope}
                    onValueChange={(value) => setFormData({ ...formData, scope: value, category: '', product_id: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">Geral (Todas as vendas)</SelectItem>
                      <SelectItem value="category">Por Categoria</SelectItem>
                      <SelectItem value="product">Por Produto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.scope === 'category' && (
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria *</Label>
                    <Input
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      required
                    />
                  </div>
                )}
                {formData.scope === 'product' && (
                  <div className="space-y-2">
                    <Label htmlFor="product_id">Produto *</Label>
                    <Select
                      value={formData.product_id}
                      onValueChange={(value) => setFormData({ ...formData, product_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} - {product.sku}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button type="submit" className="w-full">
                  Criar Regra
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Total de Regras</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rules.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {activeRules.length} ativas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Regras Gerais</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{generalRules.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Aplicadas a todos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Por Categoria</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{categoryRules.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Específicas de categoria
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Por Produto</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{productRules.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Específicas de produto
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Regras Configuradas</CardTitle>
            <CardDescription>
              As regras são aplicadas na ordem: Produto → Categoria → Geral
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Escopo</TableHead>
                  <TableHead>Base de Cálculo</TableHead>
                  <TableHead>Percentual</TableHead>
                  <TableHead>Detalhes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma regra configurada
                    </TableCell>
                  </TableRow>
                ) : (
                  rules.map((rule) => {
                    const baseInfo = getBaseInfo(rule.base);
                    const scopeInfo = getScopeInfo(rule.scope);

                    return (
                      <TableRow key={rule.id} className="hover:bg-muted/50">
                        <TableCell>
                          <Badge className={scopeInfo.color}>
                            {scopeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={baseInfo.color}>
                            {baseInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Percent className="h-4 w-4 text-muted-foreground" />
                            <span className="text-lg font-bold">{rule.percent}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {rule.scope === 'product' && rule.products && (
                            <div>
                              <div className="font-medium">{rule.products.name}</div>
                              <div className="text-xs text-muted-foreground">
                                SKU: {rule.products.sku}
                              </div>
                            </div>
                          )}
                          {rule.scope === 'category' && (
                            <div>
                              <Badge variant="outline">{rule.category}</Badge>
                            </div>
                          )}
                          {rule.scope === 'general' && (
                            <span className="text-muted-foreground">Todas as vendas</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={rule.active ? 'default' : 'secondary'}>
                            {rule.active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.active}
                              onCheckedChange={() => toggleRuleStatus(rule.id, rule.active)}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(rule)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedRule(rule);
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Regra de Comissão</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_base">Base de Cálculo *</Label>
              <Select
                value={formData.base}
                onValueChange={(value) => setFormData({ ...formData, base: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gross">Valor Bruto (Vendas)</SelectItem>
                  <SelectItem value="profit">Lucro (Vendas)</SelectItem>
                  <SelectItem value="maintenance">Manutenção (Serviços)</SelectItem>
                  <SelectItem value="revision">Revisão (Serviços)</SelectItem>
                  <SelectItem value="spraying">Pulverização (Serviços)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_percent">Percentual (%) *</Label>
              <Input
                id="edit_percent"
                type="number"
                step="0.01"
                value={formData.percent}
                onChange={(e) => setFormData({ ...formData, percent: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_scope">Escopo *</Label>
              <Select
                value={formData.scope}
                onValueChange={(value) => setFormData({ ...formData, scope: value, category: '', product_id: '' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Geral (Todas as vendas)</SelectItem>
                  <SelectItem value="category">Por Categoria</SelectItem>
                  <SelectItem value="product">Por Produto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.scope === 'category' && (
              <div className="space-y-2">
                <Label htmlFor="edit_category">Categoria *</Label>
                <Input
                  id="edit_category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  required
                />
              </div>
            )}
            {formData.scope === 'product' && (
              <div className="space-y-2">
                <Label htmlFor="edit_product_id">Produto *</Label>
                <Select
                  value={formData.product_id}
                  onValueChange={(value) => setFormData({ ...formData, product_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} - {product.sku}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
              Tem certeza que deseja excluir esta regra de comissão? Esta ação não pode ser desfeita.
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
    </AppLayout>
  );
}
