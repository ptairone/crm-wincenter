-- 1. Adicionar coluna created_by na tabela services
ALTER TABLE public.services
ADD COLUMN created_by uuid;

-- 2. Popular created_by com base no seller_auth_id do cliente para registros existentes
UPDATE public.services s
SET created_by = c.seller_auth_id
FROM public.clients c
WHERE s.client_id = c.id
  AND s.created_by IS NULL;

-- 3. Criar função que gera venda automaticamente quando serviço é concluído
CREATE OR REPLACE FUNCTION public.trg_service_completed_create_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_seller_auth_id uuid;
BEGIN
  -- Só processar quando status mudar para 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Verificar se já existe venda para este serviço
    IF EXISTS (SELECT 1 FROM public.sales WHERE service_id = NEW.id) THEN
      RETURN NEW;
    END IF;
    
    -- Determinar quem deve receber a comissão
    -- Prioridade: created_by, se não existir usa seller_auth_id do cliente
    IF NEW.created_by IS NOT NULL THEN
      v_seller_auth_id := NEW.created_by;
    ELSE
      SELECT seller_auth_id INTO v_seller_auth_id
      FROM public.clients
      WHERE id = NEW.client_id;
    END IF;
    
    -- Criar venda automaticamente
    INSERT INTO public.sales (
      client_id,
      seller_auth_id,
      service_id,
      gross_value,
      total_cost,
      estimated_profit,
      status,
      sold_at,
      payment_received
    ) VALUES (
      NEW.client_id,
      v_seller_auth_id,
      NEW.id,
      COALESCE(NEW.total_value, 0),
      0, -- Serviços geralmente não têm custo de produto
      COALESCE(NEW.total_value, 0),
      'closed',
      now(),
      false
    );
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 4. Criar trigger para executar a função
DROP TRIGGER IF EXISTS trg_service_completed_create_sale ON public.services;
CREATE TRIGGER trg_service_completed_create_sale
  AFTER UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_service_completed_create_sale();

-- 5. Adicionar comentários para documentação
COMMENT ON COLUMN public.services.created_by IS 'UUID do usuário que criou o serviço. Recebe a comissão quando serviço é concluído.';
COMMENT ON FUNCTION public.trg_service_completed_create_sale() IS 'Gera venda automaticamente quando serviço é marcado como concluído. A comissão vai para created_by.';