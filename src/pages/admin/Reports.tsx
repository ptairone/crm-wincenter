import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, Users, DollarSign, Target, Package, Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'react-router-dom';

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [salesData, setSalesData] = useState({
    totalRevenue: 0,
    totalProfit: 0,
    totalSales: 0,
    avgTicket: 0,
  });

  const [sellerData, setSellerData] = useState<any[]>([]);
  const [productData, setProductData] = useState<any[]>([]);

  // Filtros aplicados
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  // Filtros temporários (UI)
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>();
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>();

  // Inicializar filtros da URL ou defaults
  useEffect(() => {
    const urlStart = searchParams.get('start');
    const urlEnd = searchParams.get('end');

    if (urlStart) {
      const parsedStart = new Date(urlStart);
      setStartDate(parsedStart);
      setTempStartDate(parsedStart);
    } else {
      // Default: início do mês atual
      const defaultStart = startOfMonth(new Date());
      setStartDate(defaultStart);
      setTempStartDate(defaultStart);
    }

    if (urlEnd) {
      const parsedEnd = new Date(urlEnd);
      setEndDate(parsedEnd);
      setTempEndDate(parsedEnd);
    } else {
      // Default: fim do mês atual
      const defaultEnd = endOfMonth(new Date());
      setEndDate(defaultEnd);
      setTempEndDate(defaultEnd);
    }
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchReportsData();
    }
  }, [startDate, endDate]);

  const applyFilters = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);

    const params = new URLSearchParams();
    if (tempStartDate) params.set('start', tempStartDate.toISOString().split('T')[0]);
    if (tempEndDate) params.set('end', tempEndDate.toISOString().split('T')[0]);
    setSearchParams(params);
  };

  const clearFilters = () => {
    const defaultStart = startOfMonth(new Date());
    const defaultEnd = endOfMonth(new Date());
    
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setTempStartDate(defaultStart);
    setTempEndDate(defaultEnd);
    setSearchParams({});
  };

  const fetchReportsData = async () => {
    try {
      if (!startDate || !endDate) return;

      // Ajustar endDate para incluir o dia inteiro
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch sales overview com filtro de data
      let salesQuery = supabase
        .from('sales')
        .select('gross_value, estimated_profit, status, sold_at')
        .eq('status', 'closed')
        .gte('sold_at', startDate.toISOString())
        .lte('sold_at', endOfDay.toISOString());

      const { data: sales } = await salesQuery;

      const totalRevenue = sales?.reduce((sum, s) => sum + Number(s.gross_value), 0) || 0;
      const totalProfit = sales?.reduce((sum, s) => sum + Number(s.estimated_profit), 0) || 0;

      setSalesData({
        totalRevenue,
        totalProfit,
        totalSales: sales?.length || 0,
        avgTicket: sales && sales.length > 0 ? totalRevenue / sales.length : 0,
      });

      // Fetch seller performance com filtro de data
      const { data: sellers } = await supabase
        .from('users')
        .select('id, name, email, auth_user_id')
        .in('role', ['seller', 'admin', 'technician'])
        .eq('status', 'active');

      if (sellers && sellers.length > 0) {
        const sellerAuthIds = sellers.map(s => s.auth_user_id).filter(Boolean);
        
        const { data: allSales } = await supabase
          .from('sales')
          .select('seller_auth_id, gross_value, estimated_profit, status, sold_at')
          .in('seller_auth_id', sellerAuthIds)
          .eq('status', 'closed')
          .gte('sold_at', startDate.toISOString())
          .lte('sold_at', endOfDay.toISOString());

        const sellerStats = sellers.map(seller => {
          const sellerSales = allSales?.filter(s => s.seller_auth_id === seller.auth_user_id) || [];
          return {
            name: seller.name,
            email: seller.email,
            totalSales: sellerSales.length,
            totalRevenue: sellerSales.reduce((sum, s) => sum + Number(s.gross_value), 0),
            totalProfit: sellerSales.reduce((sum, s) => sum + Number(s.estimated_profit), 0),
          };
        });

        setSellerData(sellerStats.sort((a, b) => b.totalRevenue - a.totalRevenue));
      }

      // Fetch product performance com filtro de data
      // Primeiro buscar IDs das vendas no período
      const { data: periodSales } = await supabase
        .from('sales')
        .select('id')
        .eq('status', 'closed')
        .gte('sold_at', startDate.toISOString())
        .lte('sold_at', endOfDay.toISOString());

      const saleIds = periodSales?.map(s => s.id) || [];

      let saleItemsQuery = supabase
        .from('sale_items')
        .select(`
          product_id,
          qty,
          unit_price,
          discount_percent,
          products (
            name,
            category
          )
        `);

      if (saleIds.length > 0) {
        saleItemsQuery = saleItemsQuery.in('sale_id', saleIds);
      }

      const { data: saleItems } = await saleItemsQuery;

      const productStats = saleItems?.reduce((acc: any, item: any) => {
        const productId = item.product_id;
        if (!acc[productId]) {
          acc[productId] = {
            name: item.products?.name || 'Produto desconhecido',
            category: item.products?.category || 'Sem categoria',
            totalQty: 0,
            totalRevenue: 0,
          };
        }
        acc[productId].totalQty += item.qty;
        acc[productId].totalRevenue += item.unit_price * item.qty * (1 - item.discount_percent / 100);
        return acc;
      }, {});

      const productArray = Object.values(productStats || {}).sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);
      setProductData(productArray);

    } catch (error) {
      console.error('Error fetching reports:', error);
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">Análises e indicadores de desempenho</p>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros de Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1">
                <Label>Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !tempStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tempStartDate ? format(tempStartDate, "dd/MM/yyyy") : "Selecione..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={tempStartDate}
                      onSelect={setTempStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex-1">
                <Label>Data Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !tempEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tempEndDate ? format(tempEndDate, "dd/MM/yyyy") : "Selecione..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={tempEndDate}
                      onSelect={setTempEndDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex gap-2">
                <Button onClick={applyFilters}>Aplicar Filtros</Button>
                <Button variant="outline" onClick={clearFilters}>Limpar</Button>
              </div>
            </div>

            {startDate && endDate && (
              <div className="mt-3 text-sm text-muted-foreground">
                Exibindo dados de {format(startDate, "dd/MM/yyyy")} até {format(endDate, "dd/MM/yyyy")}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-4">
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
                }).format(salesData.totalRevenue)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Lucro Total</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(salesData.totalProfit)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Margem: {salesData.totalRevenue > 0 ? ((salesData.totalProfit / salesData.totalRevenue) * 100).toFixed(1) : 0}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{salesData.totalSales}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(salesData.avgTicket)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="sellers" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sellers">
              <Users className="h-4 w-4 mr-2" />
              Desempenho de Vendedores
            </TabsTrigger>
            <TabsTrigger value="products">
              <Package className="h-4 w-4 mr-2" />
              Produtos Mais Vendidos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sellers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Ranking de Vendedores</CardTitle>
                <CardDescription>Desempenho por vendedor no período</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sellerData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum dado de vendedor disponível
                    </p>
                  ) : (
                    sellerData.map((seller, index) => (
                      <div key={seller.email} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{seller.name}</div>
                            <div className="text-sm text-muted-foreground">{seller.email}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(seller.totalRevenue)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {seller.totalSales} vendas • Lucro: {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(seller.totalProfit)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Produtos Mais Vendidos</CardTitle>
                <CardDescription>Ranking por volume de vendas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {productData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum dado de produto disponível
                    </p>
                  ) : (
                    productData.slice(0, 10).map((product: any, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{product.name}</div>
                            <div className="text-sm text-muted-foreground">{product.category}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(product.totalRevenue)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {product.totalQty} unidades vendidas
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
