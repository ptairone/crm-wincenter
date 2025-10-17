import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Calendar, Plus, Eye, CheckCircle2, XCircle, Clock, Wrench, CalendarDays, ChevronLeft, ChevronRight, Pencil, Filter, X as XIcon } from 'lucide-react';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { WeatherForecast } from '@/components/WeatherForecast';
import { ClientAutocomplete } from '@/components/ClientAutocomplete';

interface Demonstration {
  id: string;
  date: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string | null;
  client_id: string;
  assigned_users: string[];
  products: string[];
  demo_types: string[];
  crop: string | null;
  hectares: number | null;
  created_at?: string;
  cancellation_reason?: string | null;
  clients?: {
    farm_name: string;
    contact_name: string;
  };
}

interface Service {
  id: string;
  date: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string | null;
  client_id: string;
  assigned_users: string[];
  service_type: 'maintenance' | 'revision' | 'spraying';
  fixed_value: number | null;
  hectares: number | null;
  value_per_hectare: number | null;
  total_value: number | null;
  warranty?: boolean;
  product_used?: string | null;
  reported_defect?: string | null;
  photos?: string[] | null;
  created_at?: string;
  cancellation_reason?: string | null;
  clients?: {
    farm_name: string;
    contact_name: string;
  };
}

interface Product {
  id: string;
  name: string;
  category: string | null;
}

interface Client {
  id: string;
  farm_name: string;
  contact_name: string;
}

interface User {
  id: string;
  auth_user_id: string;
  name: string;
  role: string;
}


export default function Demonstrations() {
  const { user, userRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [demonstrations, setDemonstrations] = useState<Demonstration[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewServiceDialogOpen, setViewServiceDialogOpen] = useState(false);
  const [selectedDemo, setSelectedDemo] = useState<Demonstration | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Filtros de período
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(undefined);
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(undefined);

  // Inicializar filtros da URL
  useEffect(() => {
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    if (startParam) {
      setStartDate(new Date(startParam));
      setTempStartDate(new Date(startParam));
    }

    if (endParam) {
      setEndDate(new Date(endParam));
      setTempEndDate(new Date(endParam));
    }
  }, [searchParams]);

  useEffect(() => {
    fetchDemonstrations();
    fetchServices();
    fetchClients();
    fetchProducts();
    // Buscar usuários tanto para admin quanto para vendedor (para exibição de nomes)
    fetchUsers();
  }, [userRole, startDate, endDate]);

  const applyFilters = () => {
    setStartDate(tempStartDate);
    setEndDate(tempEndDate);

    // Atualizar URL
    const params = new URLSearchParams();
    if (tempStartDate) {
      params.set('start', tempStartDate.toISOString().split('T')[0]);
    }
    if (tempEndDate) {
      params.set('end', tempEndDate.toISOString().split('T')[0]);
    }
    setSearchParams(params);
  };

  const clearFilters = () => {
    setTempStartDate(undefined);
    setTempEndDate(undefined);
    setStartDate(undefined);
    setEndDate(undefined);
    setSearchParams({});
  };

  const [submittingServiceId, setSubmittingServiceId] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [itemToCancel, setItemToCancel] = useState<{ id: string; type: 'demo' | 'service' } | null>(null);
  const [newClientDialogOpen, setNewClientDialogOpen] = useState(false);
  const [newClientData, setNewClientData] = useState({
    farm_name: '',
    contact_name: '',
    cpf_cnpj: '',
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
  });
  const [formData, setFormData] = useState({
    client_id: '',
    assigned_users: [] as string[],
    demo_types: [] as string[],
    crop: '',
    hectares: '',
    notes: '',
  });
  const [serviceFormData, setServiceFormData] = useState({
    client_id: '',
    assigned_users: [] as string[],
    service_type: 'maintenance' as 'maintenance' | 'revision' | 'spraying',
    date: '',
    notes: '',
    fixed_value: '',
    hectares: '',
    value_per_hectare: '',
    warranty: false,
    product_used: '',
    reported_defect: '',
    photos: [] as string[],
    product_to_add: '',
    warranty_products: [] as { name: string; quantity: number }[]
  });

  useEffect(() => {
    fetchDemonstrations();
    fetchServices();
    fetchClients();
    fetchProducts();
    // Buscar usuários tanto para admin quanto para vendedor (para exibição de nomes)
    fetchUsers();
  }, [userRole]);

  const fetchDemonstrations = async () => {
    try {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id')
        .eq('seller_auth_id', user?.id);
      
      const clientIds = clientsData?.map(c => c.id) || [];

      let query: any = supabase
        .from('demonstrations' as any)
        .select(`
          *,
          clients!demonstrations_client_id_fkey (farm_name, contact_name)
        `)
        .order('date', { ascending: true });

      if (userRole !== 'admin' && clientIds.length > 0) {
        query = query.or(`client_id.in.(${clientIds.join(',')})`);
      }

      // Aplicar filtro de período
      if (startDate) {
        query = query.gte('date', startDate.toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('date', endOfDay.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      setDemonstrations((data as any) || []);
    } catch (error) {
      console.error('Error fetching demonstrations:', error);
      toast.error('Erro ao carregar demonstrações');
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      let query = supabase
        .from('clients')
        .select('id, farm_name, contact_name')
        .order('farm_name');

      if (userRole !== 'admin') {
        query = query.or(`seller_auth_id.eq.${user?.id},owner_user_id.eq.${user?.id}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, auth_user_id, name, role')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, category')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const fetchServices = async () => {
    try {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id')
        .eq('seller_auth_id', user?.id);
      
      const clientIds = clientsData?.map(c => c.id) || [];

      let query: any = supabase
        .from('services')
        .select(`
          *,
          clients!services_client_id_fkey (farm_name, contact_name)
        `)
        .order('date', { ascending: true });

      if (userRole !== 'admin' && clientIds.length > 0) {
        query = query.or(`client_id.in.(${clientIds.join(',')}),assigned_users.cs.{${user?.id}}`);
      }

      // Aplicar filtro de período
      if (startDate) {
        query = query.gte('date', startDate.toISOString());
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('date', endOfDay.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error fetching services:', error);
      toast.error('Erro ao carregar serviços');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações específicas com mensagens claras
    if (!formData.client_id || formData.client_id.trim() === '') {
      toast.error('Por favor, selecione um cliente');
      return;
    }
    
    if (!selectedDate) {
      toast.error('Selecione uma data e hora');
      return;
    }
    
    if (formData.demo_types.length === 0) {
      toast.error('Selecione pelo menos um tipo de demonstração');
      return;
    }

    try {
      // Auto-adicionar o vendedor como responsável se nenhum for selecionado
      const assignedUsers = formData.assigned_users.length > 0 
        ? formData.assigned_users 
        : [user?.id].filter(Boolean);

      if (assignedUsers.length === 0) {
        toast.error('Selecione pelo menos um responsável');
        return;
      }

      const demoData: any = {
        client_id: formData.client_id,
        assigned_users: assignedUsers,
        demo_types: formData.demo_types,
        crop: formData.crop || null,
        hectares: formData.hectares ? parseFloat(formData.hectares) : null,
        date: new Date(selectedDate).toISOString(),
        notes: formData.notes || null,
      };

      // Adicionar dados do clima apenas se houver novos dados
      if (weatherData) {
        demoData.weather_city = weatherData.cityName;
        demoData.weather_temperature = weatherData.temperature;
        demoData.weather_humidity = weatherData.humidity;
        demoData.weather_wind_speed = weatherData.windSpeed;
        demoData.weather_will_rain = weatherData.willRain;
        demoData.weather_description = weatherData.description;
        demoData.weather_fetched_at = new Date().toISOString();
      }

      if (selectedDemo?.id) {
        // Editar demonstração existente
        const { error } = await supabase
          .from('demonstrations')
          .update(demoData)
          .eq('id', selectedDemo.id);

        if (error) {
          console.error('Update error:', error);
          throw error;
        }

        toast.success('Demonstração atualizada com sucesso!');
      } else {
        // Criar nova demonstração
        demoData.status = 'scheduled';
        
        const { error } = await supabase
          .from('demonstrations')
          .insert([demoData]);

        if (error) {
          console.error('Insert error:', error);
          throw error;
        }

        toast.success('Demonstração agendada com sucesso!');
      }

      setDialogOpen(false);
      resetForm();
      fetchDemonstrations();
    } catch (error: any) {
      console.error('Error saving demonstration:', error);
      toast.error(error.message || 'Erro ao salvar demonstração');
    }
  };

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações específicas com mensagens claras
    if (!serviceFormData.client_id || serviceFormData.client_id.trim() === '') {
      toast.error('Por favor, selecione um cliente');
      return;
    }
    
    if (!serviceFormData.date) {
      toast.error('Selecione uma data');
      return;
    }
    
    if (!serviceFormData.service_type) {
      toast.error('Selecione o tipo de serviço');
      return;
    }

    try {
      // Auto-adicionar o vendedor como responsável se nenhum for selecionado
      const assignedUsers = serviceFormData.assigned_users.length > 0 
        ? serviceFormData.assigned_users 
        : [user?.id].filter(Boolean);

      if (assignedUsers.length === 0) {
        toast.error('Selecione pelo menos um responsável');
        return;
      }

      // Não incluir total_value pois é uma coluna gerada automaticamente pelo banco
      const serviceData: any = {
        client_id: serviceFormData.client_id,
        assigned_users: assignedUsers,
        service_type: serviceFormData.service_type,
        date: new Date(serviceFormData.date).toISOString(),
        notes: serviceFormData.notes || null,
        fixed_value: serviceFormData.fixed_value ? parseFloat(serviceFormData.fixed_value) : null,
        hectares: serviceFormData.hectares ? parseFloat(serviceFormData.hectares) : null,
        value_per_hectare: serviceFormData.value_per_hectare ? parseFloat(serviceFormData.value_per_hectare) : null
      };

      // Persistir detalhes da garantia dentro de notes (não enviar cols inexistentes)
      if (serviceFormData.service_type === 'maintenance' && serviceFormData.warranty) {
        const productsNote = (serviceFormData.warranty_products && serviceFormData.warranty_products.length > 0)
          ? `Produtos: ${serviceFormData.warranty_products.map((p: any) => `${p.name} (qtd: ${p.quantity || 1})`).join(', ')}`
          : (serviceFormData.product_used ? `Produto(s): ${serviceFormData.product_used}` : null);

        const extraNotes = [
          'Garantia: Sim',
          productsNote,
          serviceFormData.reported_defect ? `Defeito: ${serviceFormData.reported_defect}` : null,
        ].filter(Boolean).join('\n');

        serviceData.notes = [serviceData.notes, extraNotes].filter(Boolean).join('\n');
      }

      if (selectedService?.id) {
        // Editar serviço existente
        const { error } = await supabase
          .from('services')
          .update(serviceData)
          .eq('id', selectedService.id);

        if (error) throw error;
        toast.success('Serviço atualizado com sucesso!');
      } else {
        // Criar novo serviço
        serviceData.status = 'scheduled';
        serviceData.created_by = user?.id; // Quem cria o serviço recebe a comissão
        
        const { error } = await supabase
          .from('services')
          .insert([serviceData]);

        if (error) throw error;
        toast.success('Serviço agendado com sucesso!');
      }

      setServiceDialogOpen(false);
      resetServiceForm();
      fetchServices();
    } catch (error: any) {
      console.error('Error saving service:', error);
      toast.error(error.message || 'Erro ao salvar serviço');
    }
  };

  const resetForm = () => {
    setSelectedDemo(null);
    setFormData({
      client_id: '',
      assigned_users: [],
      demo_types: [],
      crop: '',
      hectares: '',
      notes: '',
    });
    setSelectedDate('');
    setWeatherData(null);
  };

  const resetServiceForm = () => {
    setSelectedService(null);
    setServiceFormData({
      client_id: '',
      assigned_users: [],
      service_type: 'maintenance',
      date: '',
      notes: '',
      fixed_value: '',
      hectares: '',
      value_per_hectare: '',
    });
  };

  const handleCompleteDemo = async (id: string) => {
    try {
      const { error } = await supabase
        .from('demonstrations')
        .update({ status: 'completed' })
        .eq('id', id);

      if (error) throw error;
      toast.success('Demonstração concluída!');
      fetchDemonstrations();
    } catch (error: any) {
      console.error('Error completing demonstration:', error);
      toast.error(`Erro ao concluir demonstração: ${error?.message || 'Erro desconhecido'}`);
    }
  };

  const handleCompleteService = async (id: string) => {
    if (submittingServiceId === id) return;
    setSubmittingServiceId(id);

    try {
      // Concluir serviço - a venda será criada automaticamente pelo trigger do banco
      const { error } = await supabase
        .from('services')
        .update({ status: 'completed' })
        .eq('id', id);

      if (error) throw error;

      toast.success('Serviço concluído e venda criada automaticamente!');
      fetchServices();
    } catch (error: any) {
      console.error('Error completing service:', error);
      toast.error(`Erro ao concluir serviço: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setSubmittingServiceId(null);
    }
  };

  const handleCancelClick = (id: string, type: 'demo' | 'service') => {
    setItemToCancel({ id, type });
    setCancelReason('');
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!itemToCancel || !cancelReason.trim()) {
      toast.error('Por favor, informe o motivo do cancelamento');
      return;
    }

    try {
      if (itemToCancel.type === 'demo') {
        const { error } = await supabase
          .from('demonstrations')
          .update({ 
            status: 'cancelled',
            cancellation_reason: cancelReason.trim()
          })
          .eq('id', itemToCancel.id);

        if (error) throw error;
        toast.success('Demonstração cancelada!');
        fetchDemonstrations();
      } else {
        const { error } = await supabase
          .from('services')
          .update({ 
            status: 'cancelled',
            cancellation_reason: cancelReason.trim()
          })
          .eq('id', itemToCancel.id);

        if (error) throw error;
        toast.success('Serviço cancelado!');
        fetchServices();
      }

      setCancelDialogOpen(false);
      setItemToCancel(null);
      setCancelReason('');
    } catch (error: any) {
      console.error('Error cancelling item:', error);
      toast.error('Erro ao cancelar');
    }
  };

  const handleCreateClient = async () => {
    if (!newClientData.farm_name.trim() || !newClientData.contact_name.trim()) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    try {
      const clientData: any = {
        farm_name: newClientData.farm_name.trim(),
        contact_name: newClientData.contact_name.trim(),
        cpf_cnpj: newClientData.cpf_cnpj.trim() || null,
        email: newClientData.email.trim() || null,
        phone: newClientData.phone.trim() || null,
        whatsapp: newClientData.whatsapp.trim() || null,
        city: newClientData.city.trim() || null,
        state: newClientData.state.trim() || null,
        address: newClientData.address.trim() || null,
        cep: newClientData.cep.trim() || null,
        hectares: newClientData.hectares ? Number(newClientData.hectares) : null,
        relationship_status: newClientData.relationship_status,
        crops: newClientData.crops ? newClientData.crops.split(',').map(c => c.trim()) : null,
        location_link: newClientData.location_link.trim() || null,
        seller_auth_id: user?.id,
      };

      const { data, error } = await supabase
        .from('clients')
        .insert([clientData])
        .select()
        .single();

      if (error) throw error;

      toast.success('Cliente cadastrado com sucesso!');
      
      // Atualizar lista de clientes
      await fetchClients();
      
      // Selecionar o novo cliente no formulário
      setFormData({ ...formData, client_id: data.id });
      
      // Fechar dialog e resetar form
      setNewClientDialogOpen(false);
      setNewClientData({
        farm_name: '',
        contact_name: '',
        cpf_cnpj: '',
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
      });
    } catch (error: any) {
      console.error('Error creating client:', error);
      toast.error('Erro ao cadastrar cliente');
    }
  };





  const handleEditDemo = (demo: Demonstration) => {
    setFormData({
      client_id: demo.client_id || '',
      assigned_users: demo.assigned_users || [],
      demo_types: demo.demo_types || [],
      crop: demo.crop || '',
      hectares: demo.hectares?.toString() || '',
      notes: demo.notes || '',
    });
    setSelectedDate(new Date(demo.date).toISOString().slice(0, 16));
    setSelectedDemo(demo);
    setDialogOpen(true);
  };

  const handleEditService = (service: Service) => {
    setServiceFormData({
      client_id: service.client_id,
      assigned_users: service.assigned_users || [],
      service_type: service.service_type,
      date: new Date(service.date).toISOString().slice(0, 16),
      notes: service.notes || '',
      fixed_value: service.fixed_value?.toString() || '',
      hectares: service.hectares?.toString() || '',
      value_per_hectare: service.value_per_hectare?.toString() || '',
      warranty: service.warranty || false,
      product_used: service.product_used || '',
      reported_defect: service.reported_defect || '',
      photos: service.photos || [],
    });
    setSelectedService(service);
    setServiceDialogOpen(true);
  };



  const handleViewDemo = (demo: Demonstration) => {
    setSelectedDemo(demo);
    setViewDialogOpen(true);
  };

  const handleViewService = (service: Service) => {
    setSelectedService(service);
    setViewServiceDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      scheduled: { label: 'Agendada', className: 'bg-blue-100 text-blue-800' },
      completed: { label: 'Concluída', className: 'bg-green-100 text-green-800' },
      cancelled: { label: 'Cancelada', className: 'bg-red-100 text-red-800' },
    };
    return variants[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
  };

  const getServiceTypeName = (type: string) => {
    const types: Record<string, string> = {
      maintenance: 'Manutenção',
      revision: 'Revisão',
      spraying: 'Pulverização',
    };
    return types[type] || type;
  };

  const scheduledDemos = demonstrations.filter(d => d.status === 'scheduled');
  const completedDemos = demonstrations.filter(d => d.status === 'completed');
  const cancelledDemos = demonstrations.filter(d => d.status === 'cancelled');
  const scheduledServices = services.filter(s => s.status === 'scheduled');
  const completedServices = services.filter(s => s.status === 'completed');
  const cancelledServices = services.filter(s => s.status === 'cancelled');

  const totalItems = demonstrations.length + services.length;
  const totalScheduled = scheduledDemos.length + scheduledServices.length;
  const totalCompleted = completedDemos.length + completedServices.length;
  const totalCancelled = cancelledDemos.length + cancelledServices.length;

  // Calendar logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const getEventsForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    const demos = demonstrations.filter(d => format(new Date(d.date), 'yyyy-MM-dd') === dayStr);
    const servs = services.filter(s => format(new Date(s.date), 'yyyy-MM-dd') === dayStr);
    return { demonstrations: demos, services: servs };
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
            <h1 className="text-3xl font-bold">Demonstrações & Serviços</h1>
            <p className="text-muted-foreground">Gerencie demonstrações e serviços técnicos</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setServiceDialogOpen(true)}>
              <Wrench className="mr-2 h-4 w-4" />
              Novo Serviço
            </Button>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Demonstração
            </Button>
          </div>
        </div>

        {/* Área de Filtros */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              <CardTitle>Filtros de Período</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Data Início */}
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <Calendar className="mr-2 h-4 w-4" />
                      {tempStartDate ? format(tempStartDate, 'dd/MM/yyyy') : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={tempStartDate}
                      onSelect={setTempStartDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
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
                      <Calendar className="mr-2 h-4 w-4" />
                      {tempEndDate ? format(tempEndDate, 'dd/MM/yyyy') : 'Selecione'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={tempEndDate}
                      onSelect={setTempEndDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
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
                <XIcon className="h-4 w-4" />
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalItems}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {demonstrations.length} demos • {services.length} serviços
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Agendadas</CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{totalScheduled}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {scheduledDemos.length} demos • {scheduledServices.length} serviços
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Realizadas</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{totalCompleted}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {completedDemos.length} demos • {completedServices.length} serviços
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Canceladas</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{totalCancelled}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {cancelledDemos.length} demos • {cancelledServices.length} serviços
              </p>
            </CardContent>
          </Card>
        </div>

        <WeatherForecast />

        <Tabs defaultValue="lista" className="space-y-4">
          <TabsList>
            <TabsTrigger value="lista">Lista</TabsTrigger>
            <TabsTrigger value="calendario">
              <CalendarDays className="mr-2 h-4 w-4" />
              Calendário
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lista" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-blue-600" />
                    Agendadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {totalScheduled === 0 ? (
                      <p className="text-muted-foreground text-center py-8">Nenhum item agendado</p>
                    ) : (
                      <>
                        {scheduledDemos.map((demo) => (
                          <div key={demo.id} className="border rounded-lg p-4 space-y-3 border-l-4 border-l-green-500">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-green-50">Demonstração</Badge>
                                  <p className="font-semibold">{demo.clients?.farm_name}</p>
                                </div>
                                <p className="text-sm text-muted-foreground">{demo.clients?.contact_name}</p>
                                <p className="text-sm flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(demo.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                              </div>
                              <Badge className={getStatusBadge(demo.status).className}>
                                {getStatusBadge(demo.status).label}
                              </Badge>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <Button size="sm" variant="outline" onClick={() => handleViewDemo(demo)}>
                                <Eye className="h-3 w-3 mr-1" />
                                Ver
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => handleEditDemo(demo)}>
                                <Pencil className="h-3 w-3 mr-1" />
                                Editar
                              </Button>
                              <Button size="sm" variant="default" onClick={() => handleCompleteDemo(demo.id)}>
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Concluir
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleCancelClick(demo.id, 'demo')}>
                                <XCircle className="h-3 w-3 mr-1" />
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ))}
                        {scheduledServices.map((service) => (
                          <div key={service.id} className="border rounded-lg p-4 space-y-3 border-l-4 border-l-blue-500">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-blue-50">
                                    <Wrench className="h-3 w-3 mr-1" />
                                    {getServiceTypeName(service.service_type)}
                                  </Badge>
                                  <p className="font-semibold">{service.clients?.farm_name}</p>
                                </div>
                                <p className="text-sm text-muted-foreground">{service.clients?.contact_name}</p>
                                <p className="text-sm flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(service.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
                                {service.total_value && (
                                  <p className="text-sm font-semibold text-green-600">
                                    Valor: R$ {service.total_value.toFixed(2)}
                                  </p>
                                )}
                              </div>
                              <Badge className={getStatusBadge(service.status).className}>
                                {getStatusBadge(service.status).label}
                              </Badge>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <Button size="sm" variant="outline" onClick={() => handleViewService(service)}>
                                <Eye className="h-3 w-3 mr-1" />
                                Ver
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => handleEditService(service)}>
                                <Pencil className="h-3 w-3 mr-1" />
                                Editar
                              </Button>
                              <Button 
                                size="sm" 
                                variant="default" 
                                onClick={() => handleCompleteService(service.id)}
                                disabled={submittingServiceId === service.id}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {submittingServiceId === service.id ? 'Processando...' : 'Concluir'}
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleCancelClick(service.id, 'service')}>
                                <XCircle className="h-3 w-3 mr-1" />
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    Realizadas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {totalCompleted === 0 ? (
                      <p className="text-muted-foreground text-center py-8">Nenhum item realizado</p>
                    ) : (
                      <>
                        {completedDemos.map((demo) => (
                          <div key={demo.id} className="border rounded-lg p-4 space-y-3 border-l-4 border-l-green-500">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-green-50">Demonstração</Badge>
                                  <p className="font-semibold">{demo.clients?.farm_name}</p>
                                </div>
                                <p className="text-sm text-muted-foreground">{demo.clients?.contact_name}</p>
                                <p className="text-sm flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(demo.date), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                              </div>
                              <Badge className={getStatusBadge(demo.status).className}>
                                {getStatusBadge(demo.status).label}
                              </Badge>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleViewDemo(demo)}>
                              <Eye className="h-3 w-3 mr-1" />
                              Ver Detalhes
                            </Button>
                          </div>
                        ))}
                        {completedServices.map((service) => (
                          <div key={service.id} className="border rounded-lg p-4 space-y-3 border-l-4 border-l-blue-500">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-blue-50">
                                    <Wrench className="h-3 w-3 mr-1" />
                                    {getServiceTypeName(service.service_type)}
                                  </Badge>
                                  <p className="font-semibold">{service.clients?.farm_name}</p>
                                </div>
                                <p className="text-sm text-muted-foreground">{service.clients?.contact_name}</p>
                                <p className="text-sm flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(service.date), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                              </div>
                              <Badge className={getStatusBadge(service.status).className}>
                                {getStatusBadge(service.status).label}
                              </Badge>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleViewService(service)}>
                              <Eye className="h-3 w-3 mr-1" />
                              Ver Detalhes
                            </Button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-600" />
                    Canceladas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {totalCancelled === 0 ? (
                      <p className="text-muted-foreground text-center py-8">Nenhum item cancelado</p>
                    ) : (
                      <>
                        {cancelledDemos.map((demo) => (
                          <div key={demo.id} className="border rounded-lg p-4 space-y-3 border-l-4 border-l-red-500">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-red-50">Demonstração</Badge>
                                  <p className="font-semibold">{demo.clients?.farm_name}</p>
                                </div>
                                <p className="text-sm text-muted-foreground">{demo.clients?.contact_name}</p>
                                <p className="text-sm flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(demo.date), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                                {demo.cancellation_reason && (
                                  <div className="text-sm bg-red-50 p-2 rounded mt-2">
                                    <p className="font-medium text-red-800">Motivo do cancelamento:</p>
                                    <p className="text-red-700">{demo.cancellation_reason}</p>
                                  </div>
                                )}
                              </div>
                              <Badge className={getStatusBadge(demo.status).className}>
                                {getStatusBadge(demo.status).label}
                              </Badge>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleViewDemo(demo)}>
                              <Eye className="h-3 w-3 mr-1" />
                              Ver Detalhes
                            </Button>
                          </div>
                        ))}
                        {cancelledServices.map((service) => (
                          <div key={service.id} className="border rounded-lg p-4 space-y-3 border-l-4 border-l-red-500">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-red-50">
                                    <Wrench className="h-3 w-3 mr-1" />
                                    {getServiceTypeName(service.service_type)}
                                  </Badge>
                                  <p className="font-semibold">{service.clients?.farm_name}</p>
                                </div>
                                <p className="text-sm text-muted-foreground">{service.clients?.contact_name}</p>
                                <p className="text-sm flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(service.date), "dd/MM/yyyy", { locale: ptBR })}
                                </p>
                                {service.cancellation_reason && (
                                  <div className="text-sm bg-red-50 p-2 rounded mt-2">
                                    <p className="font-medium text-red-800">Motivo do cancelamento:</p>
                                    <p className="text-red-700">{service.cancellation_reason}</p>
                                  </div>
                                )}
                              </div>
                              <Badge className={getStatusBadge(service.status).className}>
                                {getStatusBadge(service.status).label}
                              </Badge>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleViewService(service)}>
                              <Eye className="h-3 w-3 mr-1" />
                              Ver Detalhes
                            </Button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="calendario">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Calendário de Eventos</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium min-w-[200px] text-center">
                      {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                    </span>
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(new Date())}>
                      Hoje
                    </Button>
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-green-500" />
                    Demonstrações
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded bg-blue-500" />
                    Serviços
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2">
                  {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                    <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                      {day}
                    </div>
                  ))}
                  {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                    <div key={`empty-${i}`} className="min-h-[100px] p-2" />
                  ))}
                  {daysInMonth.map((day) => {
                    const events = getEventsForDay(day);
                    const isToday = isSameDay(day, new Date());
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "min-h-[100px] border rounded-lg p-2 space-y-1",
                          isToday && "border-primary border-2"
                        )}
                      >
                        <div className={cn("text-sm font-medium", isToday && "text-primary")}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-1">
                          {events.demonstrations.map((demo) => (
                            <button
                              key={demo.id}
                              onClick={() => handleViewDemo(demo)}
                              className="w-full text-left text-xs p-1 rounded bg-green-100 hover:bg-green-200 text-green-800 truncate"
                            >
                              {demo.clients?.farm_name}
                            </button>
                          ))}
                          {events.services.map((service) => (
                            <button
                              key={service.id}
                              onClick={() => handleViewService(service)}
                              className="w-full text-left text-xs p-1 rounded bg-blue-100 hover:bg-blue-200 text-blue-800 truncate flex items-center gap-1"
                            >
                              <Wrench className="h-2 w-2" />
                              {service.clients?.farm_name}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>


        {/* Dialog para Demonstrações */}
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedDemo ? 'Editar Demonstração' : 'Agendar Demonstração'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Cliente <span className="text-red-500">*</span></Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setNewClientDialogOpen(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Novo Cliente
                  </Button>
                </div>
                <ClientAutocomplete
                  value={formData.client_id}
                  onChange={(value) => setFormData({ ...formData, client_id: value })}
                  userRole={userRole}
                  userId={user?.id}
                />
              </div>

              {userRole === 'admin' && (
                <div className="space-y-2">
                  <Label>Responsáveis (Técnicos/Vendedores)</Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                    {users.length === 0 && <p className="text-sm text-muted-foreground">Carregando usuários...</p>}
                    {users.map((user) => (
                      <label key={user.auth_user_id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.assigned_users.includes(user.auth_user_id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, assigned_users: [...formData.assigned_users, user.auth_user_id] });
                            } else {
                              setFormData({ ...formData, assigned_users: formData.assigned_users.filter(id => id !== user.auth_user_id) });
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{user.name} ({user.role})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Tipo de Demonstração <span className="text-red-500">*</span></Label>
                <div className="grid grid-cols-2 gap-2">
                  {['semeadura', 'herbicida', 'inseticida', 'fungicida'].map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer border rounded-md p-2">
                      <input
                        type="checkbox"
                        checked={formData.demo_types.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, demo_types: [...formData.demo_types, type] });
                          } else {
                            setFormData({ ...formData, demo_types: formData.demo_types.filter(t => t !== type) });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cultura</Label>
                  <Input
                    value={formData.crop}
                    onChange={(e) => setFormData({ ...formData, crop: e.target.value })}
                    placeholder="Ex: Soja, Milho, Trigo..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hectares</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.hectares}
                    onChange={(e) => setFormData({ ...formData, hectares: e.target.value })}
                    placeholder="Ex: 50.5"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Data e Hora <span className="text-red-500">*</span></Label>
                <Input
                  type="datetime-local"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Detalhes sobre a demonstração..."
                />
              </div>

              <div className="border-t pt-4">
                <WeatherForecast 
                  selectedDate={selectedDate} 
                  onWeatherChange={setWeatherData}
                  showCard={false}
                />
              </div>

              <Button type="submit" className="w-full">
                {selectedDemo ? 'Salvar Alterações' : 'Agendar Demonstração'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog para Serviços */}
        <Dialog open={serviceDialogOpen} onOpenChange={(open) => {
          setServiceDialogOpen(open);
          if (!open) resetServiceForm();
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedService ? 'Editar Serviço Técnico' : 'Agendar Serviço Técnico'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleServiceSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Cliente <span className="text-red-500">*</span></Label>
                <ClientAutocomplete
                  value={serviceFormData.client_id}
                  onChange={(value) => setServiceFormData({ ...serviceFormData, client_id: value })}
                  userRole={userRole}
                  userId={user?.id}
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo de Serviço <span className="text-red-500">*</span></Label>
                <RadioGroup
                  value={serviceFormData.service_type}
                  onValueChange={(value: 'maintenance' | 'revision' | 'spraying') => 
                    setServiceFormData({ ...serviceFormData, service_type: value })
                  }
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="maintenance" id="maintenance" />
                    <Label htmlFor="maintenance" className="cursor-pointer">Manutenção</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="revision" id="revision" />
                    <Label htmlFor="revision" className="cursor-pointer">Revisão</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="spraying" id="spraying" />
                    <Label htmlFor="spraying" className="cursor-pointer">Pulverização</Label>
                  </div>
                </RadioGroup>
              </div>

              {(serviceFormData.service_type === 'maintenance' || serviceFormData.service_type === 'revision') && (
                <>
                  <div className="space-y-2">
                    <Label>Valor Fixo (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={serviceFormData.fixed_value}
                      onChange={(e) => setServiceFormData({ ...serviceFormData, fixed_value: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  
                  {serviceFormData.service_type === 'maintenance' && (
                    <>
                      <div className="flex items-center space-x-2 pt-2">
                        <Checkbox 
                          id="warranty" 
                          checked={serviceFormData.warranty}
                          onCheckedChange={(checked) => 
                            setServiceFormData({ ...serviceFormData, warranty: checked === true })
                          }
                        />
                        <Label htmlFor="warranty" className="cursor-pointer">
                          Manutenção em garantia
                        </Label>
                      </div>
                      
                      {serviceFormData.warranty ? (
                      <div className="border border-gray-200 rounded-md p-4 mt-2 space-y-4 bg-gray-50">
                        <h4 className="font-medium text-sm">Detalhes da Garantia</h4>
                        
                        <div className="space-y-2">
                          <Label htmlFor="product_used">Produto(s) Utilizado(s)</Label>
                          <div className="flex items-center gap-2">
                            <Select
                              value={serviceFormData.product_to_add || ''}
                              onValueChange={(value) => setServiceFormData({ ...serviceFormData, product_to_add: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um produto" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((p) => (
                                  <SelectItem key={p.id} value={p.name}>
                                    {p.name}{p.category ? ` - ${p.category}` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              onClick={() => {
                                const newItem = (serviceFormData.product_to_add || '').trim();
                                if (!newItem) return;
                                const current = [ ...(serviceFormData.warranty_products || []) ];
                                if (!current.find((p: any) => p.name === newItem)) {
                                  current.push({ name: newItem, quantity: 1 });
                                }
                                setServiceFormData({
                                  ...serviceFormData,
                                  warranty_products: current,
                                  product_used: current.map((p: any) => p.name).join(', '),
                                  product_to_add: ''
                                });
                              }}
                              disabled={!serviceFormData.product_to_add || (serviceFormData.warranty_products || []).some((p: any) => p.name === serviceFormData.product_to_add)}
                            >
                              Adicionar
                            </Button>
                          </div>
                          {(serviceFormData.warranty_products || []).length > 0 && (
                            <div className="space-y-2 mt-2">
                              {(serviceFormData.warranty_products || []).map((item: any, idx: number) => (
                                <div className="flex items-center gap-2" key={item.name}>
                                  <span className="text-sm">{item.name}</span>
                                  <Input
                                    type="number"
                                    min={1}
                                    step={1}
                                    className="w-20"
                                    value={item.quantity ?? 1}
                                    onChange={(e) => {
                                      const qty = Math.max(1, parseInt(e.target.value || '1', 10));
                                      const next = [ ...(serviceFormData.warranty_products || []) ];
                                      next[idx] = { ...item, quantity: qty };
                                      setServiceFormData({
                                        ...serviceFormData,
                                        warranty_products: next,
                                        product_used: next.map((p: any) => p.name).join(', ')
                                      });
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      const next = (serviceFormData.warranty_products || []).filter((p: any) => p.name !== item.name);
                                      setServiceFormData({
                                        ...serviceFormData,
                                        warranty_products: next,
                                        product_used: next.map((p: any) => p.name).join(', ')
                                      });
                                    }}
                                  >
                                    Remover
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="reported_defect">Defeito Relatado</Label>
                          <Textarea
                            id="reported_defect"
                            value={serviceFormData.reported_defect || ''}
                            onChange={(e) => setServiceFormData({ ...serviceFormData, reported_defect: e.target.value })}
                            placeholder="Descreva o defeito relatado pelo cliente"
                            rows={3}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Fotos</Label>
                          <Input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => {
                              // Aqui seria implementado o upload das fotos
                              // Por enquanto apenas armazenamos os nomes dos arquivos
                              const files = e.target.files;
                              if (files) {
                                const fileNames = Array.from(files).map(file => file.name);
                                setServiceFormData({ 
                                  ...serviceFormData, 
                                  photos: [...(serviceFormData.photos || []), ...fileNames] 
                                });
                              }
                            }}
                          />
                          
                          {serviceFormData.photos && serviceFormData.photos.length > 0 && (
                            <div className="mt-2">
                              <p className="text-sm font-medium mb-1">Arquivos selecionados:</p>
                              <ul className="text-sm space-y-1">
                                {serviceFormData.photos.map((photo, index) => (
                                  <li key={index} className="flex items-center justify-between">
                                    <span>{photo}</span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        const newPhotos = [...serviceFormData.photos];
                                        newPhotos.splice(index, 1);
                                        setServiceFormData({ ...serviceFormData, photos: newPhotos });
                                      }}
                                    >
                                      Remover
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                    </>
                  )}
                </>
              )}

              {serviceFormData.service_type === 'spraying' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Hectares</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={serviceFormData.hectares}
                        onChange={(e) => setServiceFormData({ ...serviceFormData, hectares: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Valor por Hectare (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={serviceFormData.value_per_hectare}
                        onChange={(e) => setServiceFormData({ ...serviceFormData, value_per_hectare: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  {serviceFormData.hectares && serviceFormData.value_per_hectare && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">
                        Valor Total Calculado: R$ {(parseFloat(serviceFormData.hectares) * parseFloat(serviceFormData.value_per_hectare)).toFixed(2)}
                      </p>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-2">
                <Label>Responsáveis (Técnicos/Vendedores)</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
                  {users.length === 0 && <p className="text-sm text-muted-foreground">Carregando usuários...</p>}
                  {users.map((user) => (
                    <label key={user.auth_user_id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={serviceFormData.assigned_users.includes(user.auth_user_id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setServiceFormData({
                              ...serviceFormData,
                              assigned_users: [...serviceFormData.assigned_users, user.auth_user_id],
                            });
                          } else {
                            setServiceFormData({
                              ...serviceFormData,
                              assigned_users: serviceFormData.assigned_users.filter((id) => id !== user.auth_user_id),
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{user.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Data e Hora <span className="text-red-500">*</span></Label>
                <Input
                  type="datetime-local"
                  value={serviceFormData.date}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={serviceFormData.notes}
                  onChange={(e) => setServiceFormData({ ...serviceFormData, notes: e.target.value })}
                  placeholder="Observações adicionais..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setServiceDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {selectedService ? 'Salvar Alterações' : 'Agendar Serviço'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog para visualizar demonstração */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes da Demonstração</DialogTitle>
            </DialogHeader>
            {selectedDemo && (
              <div className="space-y-4">
                <div>
                  <Label>Cliente</Label>
                  <p className="text-sm mt-1">{selectedDemo.clients.farm_name} - {selectedDemo.clients.contact_name}</p>
                </div>
                <div>
                  <Label>Data</Label>
                  <p className="text-sm mt-1">
                    {format(new Date(selectedDemo.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
                {selectedDemo.assigned_users && selectedDemo.assigned_users.length > 0 && (
                  <div>
                    <Label>Responsáveis</Label>
                    <p className="text-sm mt-1">
                      {selectedDemo.assigned_users.map(userId => {
                        const user = users.find(u => u.auth_user_id === userId);
                        return user ? user.name : userId;
                      }).join(', ')}
                    </p>
                  </div>
                )}
                {selectedDemo.products && selectedDemo.products.length > 0 && (
                  <div>
                    <Label>Produtos Utilizados</Label>
                    <p className="text-sm mt-1">
                      {selectedDemo.products.map(productId => {
                        const product = products.find(p => p.id === productId);
                        return product ? product.name : productId;
                      }).join(', ')}
                    </p>
                  </div>
                )}
                {selectedDemo.demo_types && selectedDemo.demo_types.length > 0 && (
                  <div>
                    <Label>Tipos de Demonstração</Label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {selectedDemo.demo_types.map(type => (
                        <Badge key={type} variant="outline" className="capitalize">{type}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selectedDemo.crop && (
                  <div>
                    <Label>Cultura</Label>
                    <p className="text-sm mt-1">{selectedDemo.crop}</p>
                  </div>
                )}
                {selectedDemo.hectares && (
                  <div>
                    <Label>Hectares</Label>
                    <p className="text-sm mt-1">{selectedDemo.hectares} ha</p>
                  </div>
                )}
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">
                    <Badge className={getStatusBadge(selectedDemo.status).className}>
                      {getStatusBadge(selectedDemo.status).label}
                    </Badge>
                  </div>
                </div>
                {selectedDemo.notes && (
                  <div>
                    <Label>Observações</Label>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{selectedDemo.notes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog para visualizar serviço */}
        <Dialog open={viewServiceDialogOpen} onOpenChange={setViewServiceDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes do Serviço</DialogTitle>
            </DialogHeader>
            {selectedService && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Cliente</Label>
                    <p className="font-medium">{selectedService.clients?.farm_name}</p>
                    <p className="text-sm text-muted-foreground">{selectedService.clients?.contact_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Tipo</Label>
                    <p className="font-medium">{getServiceTypeName(selectedService.service_type)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Data</Label>
                    <p className="font-medium">
                      {format(new Date(selectedService.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge className={getStatusBadge(selectedService.status).className}>
                      {getStatusBadge(selectedService.status).label}
                    </Badge>
                  </div>
                </div>
                {selectedService.total_value && (
                  <div>
                    <Label className="text-muted-foreground">Valor Total</Label>
                    <p className="font-medium text-lg text-green-600">
                      R$ {selectedService.total_value.toFixed(2)}
                    </p>
                    <div className="text-sm text-muted-foreground mt-1">
                      {selectedService.fixed_value && <p>Valor Fixo: R$ {selectedService.fixed_value.toFixed(2)}</p>}
                      {selectedService.hectares && selectedService.value_per_hectare && (
                        <p>{selectedService.hectares} ha × R$ {selectedService.value_per_hectare.toFixed(2)}/ha</p>
                      )}
                    </div>
                  </div>
                )}
                {selectedService.assigned_users && selectedService.assigned_users.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">Responsáveis</Label>
                    <p className="text-sm">{selectedService.assigned_users.length} usuário(s) atribuído(s)</p>
                  </div>
                )}
                {selectedService.notes && (
                  <div>
                    <Label className="text-muted-foreground">Observações</Label>
                    <p className="text-sm whitespace-pre-wrap">{selectedService.notes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Dialog de Cancelamento */}
        <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancelar {itemToCancel?.type === 'demo' ? 'Demonstração' : 'Serviço'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="cancel-reason">Motivo do Cancelamento *</Label>
                <Textarea
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Informe o motivo do cancelamento..."
                  rows={4}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                  Voltar
                </Button>
                <Button variant="destructive" onClick={handleCancelConfirm}>
                  Confirmar Cancelamento
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog de Novo Cliente */}
        <Dialog open={newClientDialogOpen} onOpenChange={setNewClientDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Cliente</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="farm_name">Nome da Fazenda *</Label>
                  <Input
                    id="farm_name"
                    value={newClientData.farm_name}
                    onChange={(e) => setNewClientData({ ...newClientData, farm_name: e.target.value })}
                    placeholder="Ex: Fazenda São José"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_name">Nome do Contato *</Label>
                  <Input
                    id="contact_name"
                    value={newClientData.contact_name}
                    onChange={(e) => setNewClientData({ ...newClientData, contact_name: e.target.value })}
                    placeholder="Ex: João Silva"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cpf_cnpj">CPF/CNPJ</Label>
                  <Input
                    id="cpf_cnpj"
                    value={newClientData.cpf_cnpj}
                    onChange={(e) => setNewClientData({ ...newClientData, cpf_cnpj: e.target.value })}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newClientData.email}
                    onChange={(e) => setNewClientData({ ...newClientData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={newClientData.phone}
                    onChange={(e) => setNewClientData({ ...newClientData, phone: e.target.value })}
                    placeholder="(00) 0000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={newClientData.whatsapp}
                    onChange={(e) => setNewClientData({ ...newClientData, whatsapp: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    value={newClientData.city}
                    onChange={(e) => setNewClientData({ ...newClientData, city: e.target.value })}
                    placeholder="Ex: São Paulo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    value={newClientData.state}
                    onChange={(e) => setNewClientData({ ...newClientData, state: e.target.value })}
                    placeholder="Ex: SP"
                    maxLength={2}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={newClientData.address}
                    onChange={(e) => setNewClientData({ ...newClientData, address: e.target.value })}
                    placeholder="Ex: Rua Principal, 123"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input
                    id="cep"
                    value={newClientData.cep}
                    onChange={(e) => setNewClientData({ ...newClientData, cep: e.target.value })}
                    placeholder="00000-000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hectares">Hectares</Label>
                  <Input
                    id="hectares"
                    type="number"
                    value={newClientData.hectares}
                    onChange={(e) => setNewClientData({ ...newClientData, hectares: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="relationship_status">Status do Relacionamento</Label>
                  <Select
                    value={newClientData.relationship_status}
                    onValueChange={(value) => setNewClientData({ ...newClientData, relationship_status: value })}
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="crops">Culturas (separadas por vírgula)</Label>
                <Input
                  id="crops"
                  value={newClientData.crops}
                  onChange={(e) => setNewClientData({ ...newClientData, crops: e.target.value })}
                  placeholder="Ex: Soja, Milho, Algodão"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location_link">Link da Localização</Label>
                <Input
                  id="location_link"
                  value={newClientData.location_link}
                  onChange={(e) => setNewClientData({ ...newClientData, location_link: e.target.value })}
                  placeholder="https://maps.google.com/..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setNewClientDialogOpen(false);
                    setNewClientData({
                      farm_name: '',
                      contact_name: '',
                      cpf_cnpj: '',
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
                    });
                  }}
                >
                  Cancelar
                </Button>
                <Button type="button" onClick={handleCreateClient}>
                  <Plus className="h-4 w-4 mr-1" />
                  Cadastrar Cliente
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </AppLayout>
  );
}
