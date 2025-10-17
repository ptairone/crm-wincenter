import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { ClientFormDialog } from './ClientFormDialog';

interface Client {
  id: string;
  farm_name: string;
  contact_name: string;
}

interface ClientAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  userRole?: string;
  userId?: string;
  sellers?: Array<{ id: string; auth_user_id: string; name: string }>;
}

export function ClientAutocomplete({ value, onChange, userRole, userId, sellers }: ClientAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [newClientDialogOpen, setNewClientDialogOpen] = useState(false);

  useEffect(() => {
    fetchClients();
  }, [userRole, userId]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('clients')
        .select('id, farm_name, contact_name')
        .order('farm_name');

      // Admin e técnicos veem todos os clientes
      // Sellers veem apenas seus clientes ou clientes que eles criaram (owner_user_id)
      if (userRole === 'seller' && userId) {
        query = query.or(`seller_auth_id.eq.${userId},owner_user_id.eq.${userId}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedClient = clients.find((client) => client.id === value);

  const handleClientCreated = (clientId: string) => {
    fetchClients();
    onChange(clientId);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedClient
              ? `${selectedClient.farm_name} - ${selectedClient.contact_name}`
              : "Selecione um cliente..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar cliente..." />
            <CommandList>
              <CommandEmpty>
                {loading ? 'Carregando...' : 'Nenhum cliente encontrado.'}
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setNewClientDialogOpen(true);
                  }}
                  className="border-b mb-2 pb-2"
                >
                  <Plus className="mr-2 h-4 w-4 text-primary" />
                  <span className="font-medium text-primary">Criar novo cliente</span>
                </CommandItem>
                {clients.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={`${client.farm_name} ${client.contact_name}`}
                    onSelect={() => {
                      onChange(client.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === client.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{client.farm_name}</span>
                      <span className="text-sm text-muted-foreground">
                        {client.contact_name}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <ClientFormDialog
        open={newClientDialogOpen}
        onOpenChange={setNewClientDialogOpen}
        onClientCreated={handleClientCreated}
        sellers={sellers}
      />
    </>
  );
}
