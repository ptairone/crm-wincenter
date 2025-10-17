-- 1. Adicionar campo category na tabela notifications
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS category TEXT NULL;

-- 2. Criar função para notificar quando serviço for concluído
CREATE OR REPLACE FUNCTION public.trg_notify_service()
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
BEGIN
  -- Só notificar quando status mudar para 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Buscar nome do cliente
    SELECT contact_name INTO v_client_name
    FROM public.clients
    WHERE id = NEW.client_id;
    
    -- Mapear tipo de serviço para label em português
    v_service_label := CASE NEW.service_type
      WHEN 'maintenance' THEN 'Manutenção'
      WHEN 'revision' THEN 'Revisão'
      WHEN 'spraying' THEN 'Pulverização'
      ELSE NEW.service_type::text
    END;
    
    -- Montar array de usuários a notificar
    v_user_ids := ARRAY[]::UUID[];
    
    -- Adicionar criador do serviço (se existir)
    IF NEW.created_by IS NOT NULL THEN
      v_user_ids := array_append(v_user_ids, NEW.created_by);
    END IF;
    
    -- Adicionar vendedor do cliente
    SELECT seller_auth_id INTO v_user_id
    FROM public.clients
    WHERE id = NEW.client_id;
    
    IF v_user_id IS NOT NULL AND NOT (v_user_id = ANY(v_user_ids)) THEN
      v_user_ids := array_append(v_user_ids, v_user_id);
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
        'success',
        format('%s Concluída ✅', v_service_label),
        format('%s para %s concluída com sucesso! Valor: R$ %s',
          v_service_label,
          COALESCE(v_client_name, 'Cliente'),
          format_currency(COALESCE(NEW.total_value, 0))
        ),
        'service_' || NEW.service_type::text
      );
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Criar trigger para serviços
DROP TRIGGER IF EXISTS trg_notify_service ON public.services;
CREATE TRIGGER trg_notify_service
  AFTER INSERT OR UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_service();

-- 3. Criar função para notificar quando demonstração for concluída
CREATE OR REPLACE FUNCTION public.trg_notify_demonstration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client_name TEXT;
  v_seller_auth_id UUID;
  v_user_id UUID;
  v_user_ids UUID[];
BEGIN
  -- Só notificar quando status mudar para 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
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
        'success',
        'Demonstração Concluída ✅',
        format('Demonstração para %s concluída com sucesso!%s',
          COALESCE(v_client_name, 'Cliente'),
          CASE 
            WHEN NEW.hectares IS NOT NULL 
            THEN format(' Área: %s ha', NEW.hectares)
            ELSE ''
          END
        ),
        'demonstration'
      );
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Criar trigger para demonstrações
DROP TRIGGER IF EXISTS trg_notify_demonstration ON public.demonstrations;
CREATE TRIGGER trg_notify_demonstration
  AFTER INSERT OR UPDATE ON public.demonstrations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_demonstration();

-- 4. Atualizar função que chama edge function para filtrar por category
CREATE OR REPLACE FUNCTION public.notify_whatsapp_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Chamar edge function de forma assíncrona apenas se tiver categoria
  IF NEW.category IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://hlyhgpjzosnxaxgpcayi.supabase.co/functions/v1/send-whatsapp-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('request.jwt.claims', true)::json->>'sub'
      ),
      body := jsonb_build_object('notification_id', NEW.id)
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recriar trigger para notifications
DROP TRIGGER IF EXISTS trg_after_notification_insert ON public.notifications;
CREATE TRIGGER trg_after_notification_insert
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_whatsapp_after_insert();