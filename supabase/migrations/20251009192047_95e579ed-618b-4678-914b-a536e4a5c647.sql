-- 1. Ajustar trg_notify_sale para só notificar vendas manuais (não automáticas de serviços)
CREATE OR REPLACE FUNCTION public.trg_notify_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client_name TEXT;
  v_admin_id UUID;
BEGIN
  -- Apenas notificar quando venda MANUAL é criada (service_id IS NULL)
  IF TG_OP = 'INSERT' AND NEW.status = 'closed' AND NEW.service_id IS NULL THEN
    -- Buscar nome do cliente
    SELECT contact_name INTO v_client_name
    FROM public.clients
    WHERE id = NEW.client_id;
    
    -- Notificar vendedor
    PERFORM public.create_notification(
      NEW.seller_auth_id,
      'success',
      'Nova Venda Registrada',
      format('Venda para %s no valor de R$ %s registrada com sucesso!', 
        COALESCE(v_client_name, 'Cliente'), 
        format_currency(NEW.gross_value)
      ),
      'sale'
    );
    
    -- Notificar todos os admins
    FOR v_admin_id IN SELECT auth_user_id FROM public.get_admin_user_ids() LOOP
      PERFORM public.create_notification(
        v_admin_id,
        'info',
        'Nova Venda',
        format('Venda de R$ %s registrada para %s', 
          format_currency(NEW.gross_value),
          COALESCE(v_client_name, 'Cliente')
        ),
        'sale'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2. Ajustar trg_notify_commission para só notificar comissões de vendas manuais
CREATE OR REPLACE FUNCTION public.trg_notify_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_is_manual_sale BOOLEAN;
BEGIN
  -- Verificar se a venda é manual
  SELECT (service_id IS NULL) INTO v_is_manual_sale
  FROM sales
  WHERE id = COALESCE(NEW.sale_id, OLD.sale_id);
  
  -- INSERT: Nova comissão criada (só notificar se for venda manual)
  IF TG_OP = 'INSERT' AND v_is_manual_sale THEN
    PERFORM public.create_notification(
      NEW.seller_auth_id,
      'success',
      'Nova Comissão Gerada! 💰',
      format('Comissão de R$ %s gerada com sucesso!', 
        format_currency(NEW.amount)
      ),
      'commission'
    );
  END IF;
  
  -- UPDATE: Mudança de status de pagamento (sempre notificar)
  IF TG_OP = 'UPDATE' AND OLD.pay_status != NEW.pay_status THEN
    IF NEW.pay_status = 'paid' THEN
      PERFORM public.create_notification(
        NEW.seller_auth_id,
        'success',
        'Comissão Paga! 🎉',
        format('Sua comissão de R$ %s foi paga!', 
          format_currency(NEW.amount)
        ),
        'commission'
      );
    ELSIF NEW.pay_status = 'canceled' THEN
      PERFORM public.create_notification(
        NEW.seller_auth_id,
        'warning',
        'Comissão Cancelada',
        format('Comissão de R$ %s foi cancelada. %s', 
          format_currency(NEW.amount),
          COALESCE('Motivo: ' || NEW.notes, '')
        ),
        'commission'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 3. Criar função e trigger para notificar quando demonstração é CRIADA
CREATE OR REPLACE FUNCTION public.trg_notify_demonstration_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client_name TEXT;
  v_seller_auth_id UUID;
  v_user_ids UUID[];
  v_user_id UUID;
BEGIN
  -- Buscar nome do cliente e vendedor
  SELECT contact_name, seller_auth_id INTO v_client_name, v_seller_auth_id
  FROM public.clients
  WHERE id = NEW.client_id;
  
  -- Montar array de usuários a notificar
  v_user_ids := ARRAY[]::UUID[];
  
  -- Adicionar vendedor do cliente
  IF v_seller_auth_id IS NOT NULL THEN
    v_user_ids := array_append(v_user_ids, v_seller_auth_id);
  END IF;
  
  -- Adicionar usuários atribuídos
  IF NEW.assigned_users IS NOT NULL THEN
    FOREACH v_user_id IN ARRAY NEW.assigned_users LOOP
      IF NOT (v_user_id = ANY(v_user_ids)) THEN
        v_user_ids := array_append(v_user_ids, v_user_id);
      END IF;
    END LOOP;
  END IF;
  
  -- Criar notificação para cada usuário
  FOREACH v_user_id IN ARRAY v_user_ids LOOP
    INSERT INTO public.notifications (
      user_auth_id,
      kind,
      title,
      message,
      category
    ) VALUES (
      v_user_id,
      'info',
      'Nova Demonstração Agendada 📅',
      format('Demonstração para %s agendada para %s',
        COALESCE(v_client_name, 'Cliente'),
        to_char(NEW.date, 'DD/MM/YYYY HH24:MI')
      ),
      'demonstration'
    );
  END LOOP;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_after_demonstration_insert ON public.demonstrations;
CREATE TRIGGER trg_after_demonstration_insert
AFTER INSERT ON public.demonstrations
FOR EACH ROW
WHEN (NEW.status = 'scheduled')
EXECUTE FUNCTION public.trg_notify_demonstration_insert();

-- 4. Criar função e trigger para notificar quando serviço é CRIADO
CREATE OR REPLACE FUNCTION public.trg_notify_service_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client_name TEXT;
  v_service_label TEXT;
  v_user_ids UUID[];
  v_user_id UUID;
  v_seller_auth_id UUID;
BEGIN
  -- Buscar nome do cliente
  SELECT contact_name, seller_auth_id INTO v_client_name, v_seller_auth_id
  FROM public.clients
  WHERE id = NEW.client_id;
  
  -- Label do serviço
  v_service_label := CASE NEW.service_type
    WHEN 'maintenance' THEN 'Manutenção'
    WHEN 'revision' THEN 'Revisão'
    WHEN 'spraying' THEN 'Pulverização'
    ELSE NEW.service_type::text
  END;
  
  -- Montar array de usuários a notificar
  v_user_ids := ARRAY[]::UUID[];
  
  -- Adicionar criador
  IF NEW.created_by IS NOT NULL THEN
    v_user_ids := array_append(v_user_ids, NEW.created_by);
  END IF;
  
  -- Adicionar vendedor do cliente
  IF v_seller_auth_id IS NOT NULL AND NOT (v_seller_auth_id = ANY(v_user_ids)) THEN
    v_user_ids := array_append(v_user_ids, v_seller_auth_id);
  END IF;
  
  -- Adicionar usuários atribuídos
  IF NEW.assigned_users IS NOT NULL THEN
    FOREACH v_user_id IN ARRAY NEW.assigned_users LOOP
      IF NOT (v_user_id = ANY(v_user_ids)) THEN
        v_user_ids := array_append(v_user_ids, v_user_id);
      END IF;
    END LOOP;
  END IF;
  
  -- Criar notificação para cada usuário
  FOREACH v_user_id IN ARRAY v_user_ids LOOP
    INSERT INTO public.notifications (
      user_auth_id,
      kind,
      title,
      message,
      category
    ) VALUES (
      v_user_id,
      'info',
      format('%s Agendada 📅', v_service_label),
      format('%s para %s agendada para %s',
        v_service_label,
        COALESCE(v_client_name, 'Cliente'),
        to_char(NEW.date, 'DD/MM/YYYY HH24:MI')
      ),
      'service_' || NEW.service_type::text
    );
  END LOOP;
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_after_service_insert ON public.services;
CREATE TRIGGER trg_after_service_insert
AFTER INSERT ON public.services
FOR EACH ROW
WHEN (NEW.status = 'scheduled')
EXECUTE FUNCTION public.trg_notify_service_insert();

-- 5. Atualizar função create_notification para aceitar category
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_auth_id uuid, 
  p_kind notification_kind, 
  p_title text, 
  p_message text,
  p_category text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_auth_id, kind, title, message, category)
  VALUES (p_user_auth_id, p_kind, p_title, p_message, p_category)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$function$;