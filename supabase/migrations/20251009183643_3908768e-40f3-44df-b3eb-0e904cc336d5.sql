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
+  v_seller_auth_id UUID;
+  v_message TEXT;
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
  v_client_city TEXT;
  v_client_state TEXT;
  v_types TEXT;
  v_city TEXT;
  v_message TEXT;
BEGIN
  -- Só notificar quando status mudar para 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Buscar nome do cliente e vendedor
    SELECT contact_name, seller_auth_id, city, state INTO v_client_name, v_seller_auth_id, v_client_city, v_client_state
    FROM public.clients
    WHERE id = NEW.client_id;

    -- Montar mensagem detalhada
    SELECT string_agg(initcap(t), ', ') INTO v_types FROM unnest(NEW.demo_types) t;
    v_city := COALESCE(NULLIF(v_client_city, ''), NEW.weather_city);
    v_message := format('Cliente: %s • Data e Hora: %s',
      COALESCE(v_client_name, 'Cliente'),
      to_char(NEW.date, 'DD/MM/YYYY HH24:MI')
    );
    IF v_types IS NOT NULL THEN
      v_message := v_message || format(' • Tipo: %s', v_types);
    END IF;
    IF NEW.crop IS NOT NULL AND NEW.crop <> '' THEN
      v_message := v_message || format(' • Cultura: %s', NEW.crop);
    END IF;
    IF v_city IS NOT NULL THEN
      IF v_client_state IS NOT NULL AND v_client_state <> '' THEN
        v_message := v_message || format(' • Cidade: %s, %s', v_city, v_client_state);
      ELSE
        v_message := v_message || format(' • Cidade: %s', v_city);
      END IF;
    END IF;
    IF NEW.notes IS NOT NULL AND NEW.notes <> '' THEN
      v_message := v_message || format(' • Obs.: %s', NEW.notes);
    END IF;
+   IF NEW.hectares IS NOT NULL THEN
+     v_message := v_message || format(' • Hectares: %s ha', NEW.hectares);
+   END IF;
    
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
-   END IF;
+   -- UPDATE: Serviço agendado editado (gera nova notificação de agendamento)
+   ELSIF TG_OP = 'UPDATE' AND NEW.status = 'scheduled' THEN
+     -- Disparar apenas se campos principais foram alterados
+     IF (NEW.date IS DISTINCT FROM OLD.date)
+        OR (NEW.service_type IS DISTINCT FROM OLD.service_type)
+        OR (NEW.client_id IS DISTINCT FROM OLD.client_id)
+        OR (NEW.assigned_users IS DISTINCT FROM OLD.assigned_users)
+        OR (NEW.notes IS DISTINCT FROM OLD.notes)
+        OR (NEW.hectares IS DISTINCT FROM OLD.hectares)
+        OR (NEW.value_per_hectare IS DISTINCT FROM OLD.value_per_hectare)
+        OR (NEW.fixed_value IS DISTINCT FROM OLD.fixed_value) THEN
+       
+       -- Buscar nome do cliente e vendedor
+       SELECT contact_name, seller_auth_id INTO v_client_name, v_seller_auth_id
+       FROM public.clients
+       WHERE id = NEW.client_id;
+
+       -- Mapear tipo para label
+       v_service_label := CASE NEW.service_type
+         WHEN 'maintenance' THEN 'Manutenção'
+         WHEN 'revision' THEN 'Revisão'
+         WHEN 'spraying' THEN 'Pulverização'
+         ELSE NEW.service_type::text
+       END;
+
+       -- Montar mensagem detalhada
+       v_message := format('Cliente: %s • Data e Hora: %s',
+         COALESCE(v_client_name, 'Cliente'),
+         to_char(NEW.date, 'DD/MM/YYYY HH24:MI')
+       );
+       IF NEW.notes IS NOT NULL AND NEW.notes <> '' THEN
+         v_message := v_message || format(' • Obs.: %s', NEW.notes);
+       END IF;
+       IF NEW.hectares IS NOT NULL THEN
+         v_message := v_message || format(' • Hectares: %s ha', NEW.hectares);
+       END IF;
+       IF NEW.value_per_hectare IS NOT NULL THEN
+         v_message := v_message || format(' • Valor/ha: R$ %s', format_currency(NEW.value_per_hectare));
+       END IF;
+       IF NEW.fixed_value IS NOT NULL THEN
+         v_message := v_message || format(' • Valor fixo: R$ %s', format_currency(NEW.fixed_value));
+       END IF;
+       IF NEW.total_value IS NOT NULL THEN
+         v_message := v_message || format(' • Total: R$ %s', format_currency(NEW.total_value));
+       END IF;
+
+       -- Montar destinatários (criador, vendedor e atribuídos)
+       v_user_ids := ARRAY[]::UUID[];
+       IF NEW.created_by IS NOT NULL THEN
+         v_user_ids := array_append(v_user_ids, NEW.created_by);
+       END IF;
+       IF v_seller_auth_id IS NOT NULL AND NOT (v_seller_auth_id = ANY(v_user_ids)) THEN
+         v_user_ids := array_append(v_user_ids, v_seller_auth_id);
+       END IF;
+       IF NEW.assigned_users IS NOT NULL THEN
+         FOREACH v_user_id IN ARRAY NEW.assigned_users LOOP
+           IF NOT (v_user_id = ANY(v_user_ids)) THEN
+             v_user_ids := array_append(v_user_ids, v_user_id);
+           END IF;
+         END LOOP;
+       END IF;
+
+       -- Criar notificação idêntica à de agendamento
+       FOREACH v_user_id IN ARRAY v_user_ids LOOP
+         INSERT INTO public.notifications (
+           user_auth_id,
+           kind,
+           title,
+           message,
+           category
+         ) VALUES (
+           v_user_id,
+           'info',
+           format('%s Agendada 📅', v_service_label),
+           v_message,
+           'service_' || NEW.service_type::text
+         );
+       END LOOP;
+     END IF;
+   END IF;
+
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