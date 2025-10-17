-- Create enum for service types
CREATE TYPE service_type AS ENUM ('maintenance', 'revision', 'spraying');

-- Create enum for service status
CREATE TYPE service_status AS ENUM ('scheduled', 'completed', 'cancelled');

-- Create services table
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  assigned_users UUID[] DEFAULT ARRAY[]::uuid[],
  service_type service_type NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  status service_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  
  -- Valores por tipo de serviço
  fixed_value NUMERIC,
  hectares NUMERIC,
  value_per_hectare NUMERIC,
  total_value NUMERIC GENERATED ALWAYS AS (
    COALESCE(fixed_value, 0) + COALESCE(hectares * value_per_hectare, 0)
  ) STORED,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Vendedores podem ver serviços dos seus clientes ou onde estão atribuídos
CREATE POLICY "services_seller_view" ON public.services
FOR SELECT USING (
  is_admin() OR
  client_id IN (
    SELECT id FROM public.clients WHERE seller_auth_id = auth.uid()
  ) OR
  auth.uid() = ANY(assigned_users)
);

-- Vendedores podem criar/editar/deletar serviços dos seus clientes ou onde estão atribuídos
CREATE POLICY "services_seller_iud" ON public.services
FOR ALL USING (
  is_admin() OR
  client_id IN (
    SELECT id FROM public.clients WHERE seller_auth_id = auth.uid()
  ) OR
  auth.uid() = ANY(assigned_users)
) WITH CHECK (
  is_admin() OR
  client_id IN (
    SELECT id FROM public.clients WHERE seller_auth_id = auth.uid()
  ) OR
  auth.uid() = ANY(assigned_users)
);

-- Trigger para atualizar updated_at
CREATE TRIGGER set_updated_at_services
BEFORE UPDATE ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();