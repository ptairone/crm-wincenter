import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ClientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientCreated?: (clientId: string) => void;
  sellers?: Array<{ id: string; auth_user_id: string; name: string }>;
}

export function ClientFormDialog({ open, onOpenChange, onClientCreated, sellers }: ClientFormDialogProps) {
  const { user, userRole } = useAuth();
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

      const { data, error } = await supabase
        .from('clients')
        .insert([clientData])
        .select()
        .single();

      if (error) throw error;

      toast.success('Cliente criado com sucesso!');
      resetForm();
      onOpenChange(false);
      
      if (onClientCreated && data) {
        onClientCreated(data.id);
      }
    } catch (error: any) {
      console.error('Error creating client:', error);
      toast.error('Erro ao criar cliente: ' + error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                value={formData.cep}
                onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
              />
            </div>
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
                maxLength={2}
                placeholder="UF"
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="crops">Culturas (separadas por vírgula)</Label>
              <Input
                id="crops"
                value={formData.crops}
                onChange={(e) => setFormData({ ...formData, crops: e.target.value })}
                placeholder="Ex: Soja, Milho, Café"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relationship_status">Status *</Label>
              <Select
                value={formData.relationship_status}
                onValueChange={(value) => setFormData({ ...formData, relationship_status: value })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-[110]">
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="prospect">Prospecto</SelectItem>
                  <SelectItem value="customer">Cliente</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location_link">Link de Localização (Google Maps)</Label>
            <Input
              id="location_link"
              value={formData.location_link}
              onChange={(e) => setFormData({ ...formData, location_link: e.target.value })}
              placeholder="https://maps.google.com/..."
            />
          </div>

          {userRole === 'admin' && sellers && sellers.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="owner_user_id">Responsável (Opcional)</Label>
              <Select
                value={formData.owner_user_id}
                onValueChange={(value) => setFormData({ ...formData, owner_user_id: value })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione um responsável" />
                </SelectTrigger>
                <SelectContent className="bg-background z-[110]">
                  {sellers.map((seller) => (
                    <SelectItem key={seller.auth_user_id} value={seller.auth_user_id}>
                      {seller.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit">Salvar Cliente</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
