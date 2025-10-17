import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Receipt, Download, Printer } from 'lucide-react';

type Service = {
  id: string;
  date: string;
  status: string;
  notes?: string | null;
  client_id: string;
  service_type: 'maintenance' | 'revision' | 'spraying';
  fixed_value?: number | null;
  hectares?: number | null;
  value_per_hectare?: number | null;
  warranty?: boolean | null;
  product_used?: string | null;
  reported_defect?: string | null;
  photos?: string[] | null;
  clients?: { farm_name: string; contact_name: string } | null;
};

type Demonstration = {
  id: string;
  date: string;
  status: string;
  notes?: string | null;
  client_id: string;
  demo_types?: string[] | null;
  crop?: string | null;
  hectares?: number | null;
  products?: string[] | null;
  assigned_users?: string[] | null;
  clients?: { farm_name: string; contact_name: string } | null;
};

type ReportRecord = {
  tipo: 'Serviço' | 'Demonstração';
  data: string;
  cliente: string;
  contato: string;
  status: string;
  detalhe: string;
  valor: string;
  garantia: string;
  produtoUtilizado: string;
  defeitoRelatado: string;
  fotos: string;
  observacoes: string;
};

export default function Reports() {
  const { user, userRole } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [demonstrations, setDemonstrations] = useState<Demonstration[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [filterType, setFilterType] = useState<'all' | 'services' | 'demonstrations'>('all');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userRole, startDate, endDate]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Buscar IDs de clientes para escopo do vendedor
      let clientIds: string[] = [];
      if (userRole !== 'admin') {
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id')
          .or(`seller_auth_id.eq.${user.id},owner_user_id.eq.${user.id}`);
        clientIds = (clientsData || []).map((c: any) => c.id);
      }

      // Serviços
      let servicesQuery: any = supabase
        .from('services')
        .select(`*, clients!services_client_id_fkey (farm_name, contact_name)`) // relação usada no Demonstrations.tsx
        .order('date', { ascending: false });

      if (userRole !== 'admin') {
        if (clientIds.length > 0) {
          servicesQuery = servicesQuery.or(`client_id.in.(${clientIds.join(',')}),assigned_users.cs.{${user.id}}`);
        } else {
          servicesQuery = servicesQuery.or(`assigned_users.cs.{${user.id}}`);
        }
      }

      if (startDate) servicesQuery = servicesQuery.gte('date', new Date(startDate).toISOString());
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        servicesQuery = servicesQuery.lte('date', end.toISOString());
      }

      const { data: servicesData, error: servicesError } = await servicesQuery;
      if (servicesError) throw servicesError;
      setServices((servicesData as any) || []);

      // Demonstrações
      let demosQuery: any = supabase
        .from('demonstrations' as any)
        .select(`*, clients!demonstrations_client_id_fkey (farm_name, contact_name)`) // relação usada no Demonstrations.tsx
        .order('date', { ascending: false });

      if (userRole !== 'admin') {
        if (clientIds.length > 0) {
          demosQuery = demosQuery.or(`client_id.in.(${clientIds.join(',')})`);
        }
      }

      if (startDate) demosQuery = demosQuery.gte('date', new Date(startDate).toISOString());
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        demosQuery = demosQuery.lte('date', end.toISOString());
      }

      const { data: demosData, error: demosError } = await demosQuery;
      if (demosError) throw demosError;
      setDemonstrations((demosData as any) || []);
    } catch (error) {
      console.error('Error fetching reports data:', error);
    } finally {
      setLoading(false);
    }
  };

  const records: ReportRecord[] = useMemo(() => {
    const svcRecords: ReportRecord[] = services.map((s) => ({
      tipo: 'Serviço',
      data: s.date ? new Date(s.date).toLocaleDateString() : '',
      cliente: s.clients?.farm_name || '',
      contato: s.clients?.contact_name || '',
      status: s.status || '',
      detalhe: s.service_type || '',
      valor: (() => {
        if (s.service_type === 'spraying' && s.hectares && s.value_per_hectare) {
          const total = (s.hectares || 0) * (s.value_per_hectare || 0);
          return `R$ ${total.toFixed(2)} (${s.hectares} ha x R$ ${(s.value_per_hectare || 0).toFixed(2)})`;
        }
        if (s.fixed_value) return `R$ ${Number(s.fixed_value).toFixed(2)}`;
        return '';
      })(),
      garantia: s.warranty ? 'Sim' : 'Não',
      produtoUtilizado: s.product_used || '',
      defeitoRelatado: s.reported_defect || '',
      fotos: s.photos ? String(s.photos.length) : '0',
      observacoes: s.notes || '',
    }));

    const demoRecords: ReportRecord[] = demonstrations.map((d) => ({
      tipo: 'Demonstração',
      data: d.date ? new Date(d.date).toLocaleDateString() : '',
      cliente: d.clients?.farm_name || '',
      contato: d.clients?.contact_name || '',
      status: d.status || '',
      detalhe: d.demo_types && d.demo_types.length ? d.demo_types.join(', ') : '',
      valor: '',
      garantia: '',
      produtoUtilizado: '',
      defeitoRelatado: '',
      fotos: '',
      observacoes: d.notes || '',
    }));

    const joined = [...svcRecords, ...demoRecords];
    if (filterType === 'services') return svcRecords;
    if (filterType === 'demonstrations') return demoRecords;
    return joined.sort((a, b) => {
      const da = a.data;
      const db = b.data;
      // ordena por data (dd/mm/aaaa) convertendo para aaaa-mm-dd
      const pa = da.split('/').reverse().join('-');
      const pb = db.split('/').reverse().join('-');
      return pa < pb ? 1 : pa > pb ? -1 : 0;
    });
  }, [services, demonstrations, filterType]);

  const exportCSV = () => {
    const headers = [
      'Tipo', 'Data', 'Cliente', 'Contato', 'Status', 'Detalhe', 'Valor',
      'Garantia', 'Produto Utilizado', 'Defeito Relatado', 'Fotos', 'Observações',
    ];
    const rows = records.map((r) => [
      r.tipo, r.data, r.cliente, r.contato, r.status, r.detalhe, r.valor,
      r.garantia, r.produtoUtilizado, r.defeitoRelatado, r.fotos, r.observacoes?.replace(/\n/g, ' '),
    ]);
    const csvContent = [headers, ...rows]
      .map((cols) => cols.map((c) => `"${String(c ?? '').replace(/"/g, '"')}"`).join(','))
      .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-servicos-demonstracoes.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppLayout>
      <div className="grid gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Receipt className="h-7 w-7" /> Relatórios
            </h1>
            <p className="text-muted-foreground">Serviços e demonstrações realizados</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportCSV} variant="secondary" className="gap-2">
              <Download className="h-4 w-4" /> Exportar CSV
            </Button>
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" /> Imprimir
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <div className="flex gap-2">
                  <Button variant={filterType === 'all' ? 'default' : 'outline'} onClick={() => setFilterType('all')}>Todos</Button>
                  <Button variant={filterType === 'services' ? 'default' : 'outline'} onClick={() => setFilterType('services')}>Serviços</Button>
                  <Button variant={filterType === 'demonstrations' ? 'default' : 'outline'} onClick={() => setFilterType('demonstrations')}>Demonstrações</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultados</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Detalhe</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Garantia</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Defeito</TableHead>
                      <TableHead>Fotos</TableHead>
                      <TableHead>Obs.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((r, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Badge variant={r.tipo === 'Serviço' ? 'default' : 'secondary'}>{r.tipo}</Badge>
                        </TableCell>
                        <TableCell>{r.data}</TableCell>
                        <TableCell>{r.cliente}</TableCell>
                        <TableCell>{r.contato}</TableCell>
                        <TableCell>{r.status}</TableCell>
                        <TableCell>{r.detalhe}</TableCell>
                        <TableCell>{r.valor}</TableCell>
                        <TableCell>{r.garantia}</TableCell>
                        <TableCell>{r.produtoUtilizado}</TableCell>
                        <TableCell>{r.defeitoRelatado}</TableCell>
                        <TableCell>{r.fotos}</TableCell>
                        <TableCell className="max-w-[240px] truncate" title={r.observacoes}>{r.observacoes}</TableCell>
                      </TableRow>
                    ))}
                    {records.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center text-muted-foreground py-6">
                          Nenhum registro encontrado para os filtros selecionados.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}