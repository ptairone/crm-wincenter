import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, MapPin, Leaf, Mail, Phone, MessageCircle, Calendar, Edit, Eye, User, DollarSign, Package, ShieldCheck, Download } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Client {
  id: string;
  farm_name: string;
  contact_name: string;
  email: string;
  phone: string;
  whatsapp: string;
  city: string;
  state: string;
  hectares: number;
  relationship_status: string;
  crops: string[];
  location_link?: string;
  seller_name?: string;
  address?: string;
  cep?: string;
  owner_user_id?: string;
  seller_auth_id?: string;
}

interface Seller {
  id: string;
  auth_user_id: string;
  name: string;
}

interface Visit {
  id: string;
  scheduled_at: string;
  status: string;
  objective: string;
  notes: string;
  duration_min: number;
}

interface Demonstration {
  id: string;
  date: string;
  status: string;
  notes: string;
}

interface Sale {
  id: string;
  sold_at: string;
  gross_value: number;
  status: string;
  estimated_profit: number;
}

// Serviços do cliente (usados para listar garantias)
interface Service {
  id: string;
  date: string;
  status: string;
  service_type: 'maintenance' | 'revision' | 'spraying';
  notes: string | null;
}

interface ClientHistory {
  visits: Visit[];
  demonstrations: Demonstration[];
  sales: Sale[];
  warranties: Service[];
}

export default function Clients() {
  const { user, userRole } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [visitDialogOpen, setVisitDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<Client | null>(null);
  const [clientHistory, setClientHistory] = useState<ClientHistory>({
    visits: [],
    demonstrations: [],
    sales: [],
    warranties: []
  });
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  const [sellers, setSellers] = useState<Seller[]>([]);
  
  const [formData, setFormData] = useState({
    farm_name: '',
    contact_name: '',
    email: '',
    phone: '',
    whatsapp: '',
    city: '',
    state: '',
    address: '',
    cep: '',
    hectares: '',
    relationship_status: 'lead',
    crops: '',
    location_link: '',
    owner_user_id: '',
  });

  const [visitFormData, setVisitFormData] = useState({
    scheduled_at: '',
    objective: '',
    notes: '',
  });

  useEffect(() => {
    fetchClients();
    if (userRole === 'admin') {
      fetchSellers();
    }
  }, [user, userRole]);

  const fetchClients = async () => {
    try {
      let query = supabase
        .from('clients')
        .select(`
          *
        `)
        .order('created_at', { ascending: false });

      if (userRole === 'seller') {
        query = query.or(`seller_auth_id.eq.${user?.id},owner_user_id.eq.${user?.id}`);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Buscar nomes dos usuários responsáveis
      const ownerIds = [...new Set((data || [])
        .map(c => c.owner_user_id)
        .filter(Boolean))];
      
      const sellerIds = [...new Set((data || [])
        .map(c => c.seller_auth_id)
        .filter(Boolean))];
      
      const allUserIds = [...new Set([...ownerIds, ...sellerIds])];
      
      let usersMap: Record<string, string> = {};
      
      if (allUserIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('auth_user_id, name')
          .in('auth_user_id', allUserIds);
        
        if (usersData) {
          usersMap = usersData.reduce((acc, user) => {
            acc[user.auth_user_id] = user.name;
            return acc;
          }, {} as Record<string, string>);
        }
      }
      
      const clientsWithSeller = (data || []).map((client: any) => {
        // Priorizar owner_user_id (técnico responsável), depois seller_auth_id (criador)
        const sellerName = usersMap[client.owner_user_id] || usersMap[client.seller_auth_id] || 'N/A';
        return {
          ...client,
          seller_name: sellerName,
        };
      });
      
      setClients(clientsWithSeller);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSellers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, auth_user_id, name')
        .eq('role', 'seller')
        .eq('status', 'active')
        .order('name');
      if (error) throw error;
      setSellers(data || []);
      // Refetch clients after sellers are loaded to update seller names
      if (userRole === 'admin') {
        fetchClients();
      }
    } catch (error) {
      console.error('Error fetching sellers:', error);
    }
  };

  const filteredClients = clients.filter(client =>
    client.farm_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.city?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      lead: 'bg-blue-100 text-blue-800',
      prospect: 'bg-yellow-100 text-yellow-800',
      customer: 'bg-green-100 text-green-800',
      inactive: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      lead: 'Lead',
      prospect: 'Prospecto',
      customer: 'Cliente',
      inactive: 'Inativo',
    };
    return labels[status] || status;
  };

  const resetForm = () => {
    setFormData({
      farm_name: '',
      contact_name: '',
      email: '',
      phone: '',
      whatsapp: '',
      city: '',
      state: '',
      address: '',
      cep: '',
      hectares: '',
      relationship_status: 'lead',
      crops: '',
      location_link: '',
      owner_user_id: '',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const clientData: any = {
        farm_name: formData.farm_name,
        contact_name: formData.contact_name,
        email: formData.email || null,
        phone: formData.phone || null,
        whatsapp: formData.whatsapp || null,
        city: formData.city,
        state: formData.state,
        address: formData.address || null,
        cep: formData.cep || null,
        hectares: formData.hectares ? Number(formData.hectares) : null,
        relationship_status: formData.relationship_status,
        crops: formData.crops ? formData.crops.split(',').map(c => c.trim()) : null,
        location_link: formData.location_link || null,
        seller_auth_id: user?.id,
        ...(userRole === 'admin' ? { owner_user_id: formData.owner_user_id || null } : {}),
      };

      const { error } = await supabase
        .from('clients')
        .insert([clientData]);

      if (error) throw error;

      toast.success('Cliente criado com sucesso!');
      setDialogOpen(false);
      resetForm();
      fetchClients();
    } catch (error: any) {
      console.error('Error creating client:', error);
      toast.error('Erro ao criar cliente: ' + error.message);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      farm_name: client.farm_name || '',
      contact_name: client.contact_name || '',
      email: client.email || '',
      phone: client.phone || '',
      whatsapp: client.whatsapp || '',
      city: client.city || '',
      state: client.state || '',
      address: '',
      cep: '',
      hectares: client.hectares?.toString() || '',
      relationship_status: client.relationship_status || 'lead',
      crops: client.crops?.join(', ') || '',
      location_link: client.location_link || '',
      owner_user_id: (client as any).owner_user_id || '',
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    try {
      const clientData: any = {
        farm_name: formData.farm_name,
        contact_name: formData.contact_name,
        email: formData.email || null,
        phone: formData.phone || null,
        whatsapp: formData.whatsapp || null,
        city: formData.city,
        state: formData.state,
        address: formData.address || null,
        cep: formData.cep || null,
        hectares: formData.hectares ? Number(formData.hectares) : null,
        relationship_status: formData.relationship_status,
        crops: formData.crops ? formData.crops.split(',').map(c => c.trim()) : null,
        location_link: formData.location_link || null,
        ...(userRole === 'admin' ? { owner_user_id: formData.owner_user_id || null } : {}),
      };

      const { error } = await supabase
        .from('clients')
        .update(clientData)
        .eq('id', editingClient.id);

      if (error) throw error;

      toast.success('Cliente atualizado com sucesso!');
      setEditDialogOpen(false);
      setEditingClient(null);
      resetForm();
      fetchClients();
    } catch (error: any) {
      console.error('Error updating client:', error);
      toast.error('Erro ao atualizar cliente: ' + error.message);
    }
  };

  const handleWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const toggleClientSelection = (clientId: string) => {
    setSelectedClients(prev =>
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleScheduleVisit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const visits = selectedClients.map(clientId => ({
        client_id: clientId,
        seller_auth_id: user?.id,
        scheduled_at: visitFormData.scheduled_at,
        objective: visitFormData.objective || null,
        notes: visitFormData.notes || null,
      }));

      const { error } = await supabase
        .from('visits')
        .insert(visits);

      if (error) throw error;

      toast.success('Visitas agendadas com sucesso!');
      setVisitDialogOpen(false);
      setSelectedClients([]);
      setVisitFormData({ scheduled_at: '', objective: '', notes: '' });
    } catch (error: any) {
      console.error('Error scheduling visits:', error);
      toast.error('Erro ao agendar visitas: ' + error.message);
    }
  };

  const handleViewHistory = async (client: Client) => {
    setSelectedClientForHistory(client);
    setHistoryDialogOpen(true);
    setLoadingHistory(true);

    try {
      // Fetch visits
      const { data: visits, error: visitsError } = await supabase
        .from('visits')
        .select('*')
        .eq('client_id', client.id)
        .order('scheduled_at', { ascending: false });

      if (visitsError) throw visitsError;

      // Fetch demonstrations
      const { data: demonstrations, error: demosError } = await supabase
        .from('demonstrations')
        .select('*')
        .eq('client_id', client.id)
        .order('date', { ascending: false });

      if (demosError) throw demosError;

      // Fetch sales
      const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .eq('client_id', client.id)
        .order('sold_at', { ascending: false });

      if (salesError) throw salesError;

      // Fetch services and filter warranties (Garantia: Sim)
      const { data: services, error: servicesError } = await supabase
        .from('services')
        .select('*')
        .eq('client_id', client.id)
        .order('date', { ascending: false });

      if (servicesError) throw servicesError;

      const warranties = (services || []).filter((s: any) => 
        s.service_type === 'maintenance' && ((s.notes || '').includes('Garantia: Sim'))
      );

      setClientHistory({
        visits: visits || [],
        demonstrations: demonstrations || [],
        sales: sales || [],
        warranties: warranties as Service[]
      });
    } catch (error: any) {
      console.error('Error fetching client history:', error);
      toast.error('Erro ao carregar histórico do cliente');
    } finally {
      setLoadingHistory(false);
    }
  };

  const getVisitStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getVisitStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      scheduled: 'Agendada',
      completed: 'Realizada',
      cancelled: 'Cancelada',
    };
    return labels[status] || status;
  };

  const getDemoStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getDemoStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      scheduled: 'Agendada',
      completed: 'Concluída',
      cancelled: 'Cancelada',
    };
    return labels[status] || status;
  };

  const getSaleStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      closed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getSaleStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      closed: 'Fechada',
      pending: 'Pendente',
      cancelled: 'Cancelada',
    };
    return labels[status] || status;
  };

  const handleDownloadHistoryPDF = () => {
    if (!selectedClientForHistory) {
      toast.error('Selecione um cliente para exportar.');
      return;
    }

    const dateFmt = (d: string) => format(new Date(d), "dd/MM/yyyy", { locale: ptBR });
    const dateTimeFmt = (d: string) => format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

    const style = `
      body { font-family: Inter, Arial, sans-serif; padding: 24px; color: #111827; }
      h1 { font-size: 20px; margin: 0; }
      h2 { font-size: 18px; margin: 8px 0 16px; }
      .section { margin-top: 24px; }
      .section-title { font-size: 16px; margin-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; vertical-align: top; }
      th { background: #f9fafb; font-weight: 600; }
      .meta { color: #6b7280; margin-top: 4px; }
    `;

    const makeTable = (title: string, headers: string[], rows: string[][]) => {
      const thead = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
      const tbody = rows.length
        ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${headers.length}" style="text-align:center;color:#6b7280">Nenhum registro</td></tr>`;
      return `
        <div class="section">
          <div class="section-title">${title}</div>
          <table>
            <thead>${thead}</thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
      `;
    };

    const currency = (v: number) =>
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    const sellerName = ((selectedClientForHistory as any)?.owner_user_id
      ? (sellers.find((s) => s.id === (selectedClientForHistory as any).owner_user_id)?.name || selectedClientForHistory?.seller_name)
      : selectedClientForHistory?.seller_name) || '-';

    const visitsRows = clientHistory.visits.map(v => [
      dateTimeFmt(v.scheduled_at),
      getVisitStatusLabel(v.status),
      v.objective || '-',
      v.notes || '-',
    ]);

    const demoRows = clientHistory.demonstrations.map(d => [
      dateFmt(d.date),
      getDemoStatusLabel(d.status),
      d.notes || '-',
    ]);

    const warrantyRows = clientHistory.warranties.map(s => [
      dateFmt(s.date),
      'Manutenção em garantia',
      getDemoStatusLabel(s.status),
      s.notes || '-',
    ]);

    const salesRows = clientHistory.sales.map(s => [
      dateFmt(s.sold_at),
      getSaleStatusLabel(s.status),
      currency(s.gross_value),
      currency(s.estimated_profit),
    ]);

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Histórico - ${selectedClientForHistory.farm_name}</title>
          <style>${style}</style>
        </head>
        <body>
          <h1>Histórico do Cliente</h1>
          <h2>${selectedClientForHistory.farm_name}</h2>
          <div class="meta">Responsável: ${sellerName}</div>
          ${makeTable('Visitas', ['Data/Hora', 'Status', 'Objetivo', 'Notas'], visitsRows)}
          ${makeTable('Demonstrações', ['Data', 'Status', 'Notas'], demoRows)}
          ${makeTable('Garantias', ['Data', 'Tipo', 'Status', 'Notas'], warrantyRows)}
          ${makeTable('Vendas', ['Data', 'Status', 'Valor Bruto', 'Lucro Estimado'], salesRows)}
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=650');
    if (!printWindow) {
      toast.error('Falha ao abrir a janela de impressão.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

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
            <h1 className="text-3xl font-bold">Clientes</h1>
            <p className="text-muted-foreground">Gerencie sua carteira de clientes</p>
          </div>
          <div className="flex gap-2">
            {selectedClients.length > 0 && (
              <Button onClick={() => setVisitDialogOpen(true)} variant="outline">
                <Calendar className="mr-2 h-4 w-4" />
                Agendar Visita ({selectedClients.length})
              </Button>
            )}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Cliente
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Novo Cliente</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="farm_name">Nome da Fazenda *</Label>
                      <Input
                        id="farm_name"
                        value={formData.farm_name}
                        onChange={(e) => setFormData({ ...formData, farm_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact_name">Nome do Contato *</Label>
                      <Input
                        id="contact_name"
                        value={formData.contact_name}
                        onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp">WhatsApp</Label>
                      <Input
                        id="whatsapp"
                        value={formData.whatsapp}
                        onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hectares">Hectares</Label>
                      <Input
                        id="hectares"
                        type="number"
                        value={formData.hectares}
                        onChange={(e) => setFormData({ ...formData, hectares: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">Cidade *</Label>
                      <Input
                        id="city"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">Estado *</Label>
                      <Input
                        id="state"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cep">CEP</Label>
                      <Input
                        id="cep"
                        value={formData.cep}
                        onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location_link">Link da Localização</Label>
                    <Input
                      id="location_link"
                      placeholder="https://maps.google.com/..."
                      value={formData.location_link}
                      onChange={(e) => setFormData({ ...formData, location_link: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="relationship_status">Status *</Label>
                    <Select
                      value={formData.relationship_status}
                      onValueChange={(value) => setFormData({ ...formData, relationship_status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lead">Lead</SelectItem>
                        <SelectItem value="prospect">Prospecto</SelectItem>
                        <SelectItem value="customer">Cliente</SelectItem>
                        <SelectItem value="inactive">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="crops">Culturas (separadas por vírgula)</Label>
                    <Input
                      id="crops"
                      value={formData.crops}
                      onChange={(e) => setFormData({ ...formData, crops: e.target.value })}
                      placeholder="Ex: Soja, Milho, Algodão"
                    />
                  </div>
                  {userRole === 'admin' && (
                    <div className="space-y-2">
                      <Label htmlFor="owner_user_id">Responsável (opcional)</Label>
                      <Select
                        value={formData.owner_user_id}
                        onValueChange={(value) => setFormData({ ...formData, owner_user_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um vendedor" />
                        </SelectTrigger>
                        <SelectContent>
                          {sellers.map((seller) => (
                            <SelectItem key={seller.auth_user_id} value={seller.auth_user_id}>
                              {seller.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Button type="submit" className="w-full">
                    Criar Cliente
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {clients.filter(c => c.relationship_status === 'customer').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Prospectos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {clients.filter(c => c.relationship_status === 'prospect').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {clients.filter(c => c.relationship_status === 'lead').length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Lista de Clientes</CardTitle>
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar clientes..."
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
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Fazenda</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Hectares</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => (
                    <TableRow key={client.id} className="hover:bg-muted/50">
                      <TableCell>
                        <Checkbox
                          checked={selectedClients.includes(client.id)}
                          onCheckedChange={() => toggleClientSelection(client.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{client.farm_name || 'Sem nome'}</div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{client.contact_name}</div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {client.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {client.email}
                              </span>
                            )}
                            {client.whatsapp && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {client.whatsapp}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">
                            {client.city}, {client.state}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Leaf className="h-3 w-3 text-muted-foreground" />
                          <span>{client.hectares || 0} ha</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(client.relationship_status)}>
                          {getStatusLabel(client.relationship_status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{client.seller_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewHistory(client)}
                            title="Ver Histórico"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {client.whatsapp && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleWhatsApp(client.whatsapp)}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(client)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome da Fazenda *</Label>
                  <Input
                    value={formData.farm_name}
                    onChange={(e) => setFormData({ ...formData, farm_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome do Contato *</Label>
                  <Input
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hectares</Label>
                  <Input
                    type="number"
                    value={formData.hectares}
                    onChange={(e) => setFormData({ ...formData, hectares: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Cidade *</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado *</Label>
                  <Input
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input
                    value={formData.cep}
                    onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Link da Localização</Label>
                <Input
                  placeholder="https://maps.google.com/..."
                  value={formData.location_link}
                  onChange={(e) => setFormData({ ...formData, location_link: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status *</Label>
                <Select
                  value={formData.relationship_status}
                  onValueChange={(value) => setFormData({ ...formData, relationship_status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="prospect">Prospecto</SelectItem>
                    <SelectItem value="customer">Cliente</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Culturas (separadas por vírgula)</Label>
                <Input
                  value={formData.crops}
                  onChange={(e) => setFormData({ ...formData, crops: e.target.value })}
                  placeholder="Ex: Soja, Milho, Algodão"
                />
              </div>
              {userRole === 'admin' && (
                <div className="space-y-2">
                  <Label htmlFor="edit_owner_user_id">Responsável (opcional)</Label>
                  <Select
                    value={formData.owner_user_id}
                    onValueChange={(value) => setFormData({ ...formData, owner_user_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {sellers.map((seller) => (
                        <SelectItem key={seller.auth_user_id} value={seller.auth_user_id}>
                          {seller.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button type="submit" className="w-full">
                Salvar Alterações
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Schedule Visit Dialog */}
        <Dialog open={visitDialogOpen} onOpenChange={setVisitDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Agendar Visita</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleScheduleVisit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scheduled_at">Data e Hora *</Label>
                <Input
                  id="scheduled_at"
                  type="datetime-local"
                  value={visitFormData.scheduled_at}
                  onChange={(e) => setVisitFormData({ ...visitFormData, scheduled_at: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="objective">Objetivo</Label>
                <Input
                  id="objective"
                  placeholder="Ex: Apresentar novos produtos"
                  value={visitFormData.objective}
                  onChange={(e) => setVisitFormData({ ...visitFormData, objective: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  placeholder="Notas sobre a visita"
                  value={visitFormData.notes}
                  onChange={(e) => setVisitFormData({ ...visitFormData, notes: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full">
                Agendar
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Client History Dialog */}
        <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-2xl">
                    {selectedClientForHistory?.farm_name}
                  </DialogTitle>
                  <div className="flex items-center gap-3 mt-2">
                    <Badge className={getStatusColor(selectedClientForHistory?.relationship_status || '')}>
                      {getStatusLabel(selectedClientForHistory?.relationship_status || '')}
                    </Badge>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      {((selectedClientForHistory as any)?.owner_user_id
                        ? (sellers.find((s) => s.id === (selectedClientForHistory as any).owner_user_id)?.name || selectedClientForHistory?.seller_name)
                        : selectedClientForHistory?.seller_name)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" className="gap-2" onClick={handleDownloadHistoryPDF}>
                    <Download className="h-4 w-4" /> Baixar PDF
                  </Button>
                </div>
              </div>
            </DialogHeader>

            {loadingHistory ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Client Information Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Informações do Cliente</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Contato</p>
                        <p className="text-sm">{selectedClientForHistory?.contact_name}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Email</p>
                        <p className="text-sm">{selectedClientForHistory?.email || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Telefone</p>
                        <p className="text-sm">{selectedClientForHistory?.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">WhatsApp</p>
                        <p className="text-sm">{selectedClientForHistory?.whatsapp || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Localização</p>
                        <p className="text-sm">
                          {selectedClientForHistory?.city}, {selectedClientForHistory?.state}
                        </p>
                        {selectedClientForHistory?.address && (
                          <p className="text-sm text-muted-foreground">{selectedClientForHistory.address}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Hectares</p>
                        <p className="text-sm">{selectedClientForHistory?.hectares || 0} ha</p>
                      </div>
                    </div>
                    {selectedClientForHistory?.crops && selectedClientForHistory.crops.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-2">Culturas</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedClientForHistory.crops.map((crop, idx) => (
                            <Badge key={idx} variant="outline" className="flex items-center gap-1">
                              <Leaf className="h-3 w-3" />
                              {crop}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedClientForHistory?.location_link && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Link da Localização</p>
                        <a
                          href={selectedClientForHistory.location_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline flex items-center gap-1"
                        >
                          <MapPin className="h-3 w-3" />
                          Ver no mapa
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* History Tabs */}
                <Tabs defaultValue="visits" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="visits">
                      <Calendar className="h-4 w-4 mr-2" />
                      Visitas ({clientHistory.visits.length})
                    </TabsTrigger>
                    <TabsTrigger value="demonstrations">
                      <Package className="h-4 w-4 mr-2" />
                      Demonstrações ({clientHistory.demonstrations.length})
                    </TabsTrigger>
                    <TabsTrigger value="warranties">
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Garantias ({clientHistory.warranties.length})
                    </TabsTrigger>
                    <TabsTrigger value="sales">
                      <DollarSign className="h-4 w-4 mr-2" />
                      Vendas ({clientHistory.sales.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="visits" className="space-y-4">
                    {clientHistory.visits.length === 0 ? (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          Nenhuma visita registrada
                        </CardContent>
                      </Card>
                    ) : (
                      clientHistory.visits.map((visit) => (
                        <Card key={visit.id}>
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="font-medium">
                                  {format(new Date(visit.scheduled_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                                {visit.objective && (
                                  <p className="text-sm text-muted-foreground mt-1">{visit.objective}</p>
                                )}
                              </div>
                              <Badge className={getVisitStatusColor(visit.status)}>
                                {getVisitStatusLabel(visit.status)}
                              </Badge>
                            </div>
                            {visit.notes && (
                              <div className="mt-3 p-3 bg-muted/50 rounded-md">
                                <p className="text-sm">{visit.notes}</p>
                              </div>
                            )}
                            {visit.duration_min && (
                              <p className="text-sm text-muted-foreground mt-2">
                                Duração: {visit.duration_min} minutos
                              </p>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="demonstrations" className="space-y-4">
                    {clientHistory.demonstrations.length === 0 ? (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          Nenhuma demonstração registrada
                        </CardContent>
                      </Card>
                    ) : (
                      clientHistory.demonstrations.map((demo) => (
                        <Card key={demo.id}>
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="font-medium">
                                  {format(new Date(demo.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                </p>
                              </div>
                              <Badge className={getDemoStatusColor(demo.status)}>
                                {getDemoStatusLabel(demo.status)}
                              </Badge>
                            </div>
                            {demo.notes && (
                              <div className="mt-3 p-3 bg-muted/50 rounded-md">
                                <p className="text-sm">{demo.notes}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="warranties" className="space-y-4">
                    {clientHistory.warranties.length === 0 ? (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          Nenhuma garantia registrada
                        </CardContent>
                      </Card>
                    ) : (
                      clientHistory.warranties.map((svc) => (
                        <Card key={svc.id}>
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="font-medium">
                                  {format(new Date(svc.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">Serviço: Manutenção em garantia</p>
                              </div>
                              <Badge className={getDemoStatusColor(svc.status)}>
                                {getDemoStatusLabel(svc.status)}
                              </Badge>
                            </div>
                            {svc.notes && (
                              <div className="mt-3 p-3 bg-muted/50 rounded-md">
                                <p className="text-sm whitespace-pre-line">{svc.notes}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </TabsContent>

                  <TabsContent value="sales" className="space-y-4">
                    {clientHistory.sales.length === 0 ? (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          Nenhuma venda registrada
                        </CardContent>
                      </Card>
                    ) : (
                      clientHistory.sales.map((sale) => (
                        <Card key={sale.id}>
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className="font-medium">
                                  {format(new Date(sale.sold_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                </p>
                                <p className="text-2xl font-bold text-primary mt-2">
                                  {new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL'
                                  }).format(sale.gross_value)}
                                </p>
                              </div>
                              <Badge className={getSaleStatusColor(sale.status)}>
                                {getSaleStatusLabel(sale.status)}
                              </Badge>
                            </div>
                            <div className="mt-3 p-3 bg-muted/50 rounded-md">
                              <p className="text-sm">
                                Lucro Estimado: {' '}
                                <span className="font-medium text-green-600">
                                  {new Intl.NumberFormat('pt-BR', {
                                    style: 'currency',
                                    currency: 'BRL'
                                  }).format(sale.estimated_profit)}
                                </span>
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
