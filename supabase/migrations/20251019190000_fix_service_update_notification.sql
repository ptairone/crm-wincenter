-- Corrigir triggers de notificação de serviços e demonstrações
-- Move a lógica de notificação de edição (UPDATE scheduled) para public.trg_notify_service()
-- Remove lógica indevida de serviços dentro de public.trg_notify_demonstration()

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
  v_seller_auth_id UUID;
  v_message TEXT;
BEGIN
  -- UPDATE para concluído: criar notificação de conclusão
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    -- Buscar nome do cliente
    SELECT contact_name INTO v_client_name
    FROM public.clients
    WHERE id = NEW.client_id;

    -- Mapear tipo de serviço
    v_service_label := CASE NEW.service_type
      WHEN 'maintenance' THEN 'Manutenção'
      WHEN 'revision' THEN 'Revisão'
      WHEN 'spraying' THEN 'Pulverização'
      ELSE NEW.service_type::text
    END;

    -- Destinatários: criador, vendedor e usuários atribuídos
    v_user_ids := ARRAY[]::UUID[];
    IF NEW.created_by IS NOT NULL THEN
      v_user_ids := array_append(v_user_ids, NEW.created_by);
    END IF;
    SELECT seller_auth_id INTO v_user_id FROM public.clients WHERE id = NEW.client_id;
    IF v_user_id IS NOT NULL AND NOT (v_user_id = ANY(v_user_ids)) THEN
      v_user_ids := array_append(v_user_ids, v_user_id);
    END IF;
    IF NEW.assigned_users IS NOT NULL THEN
      FOREACH v_user_id IN ARRAY NEW.assigned_users LOOP
        IF NOT (v_user_id = ANY(v_user_ids)) THEN
          v_user_ids := array_append(v_user_ids, v_user_id);
        END IF;
      END LOOP;
    END IF;

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

  -- UPDATE para agendado: gerar nova notificação completa quando editar serviço
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'scheduled' THEN
    -- Disparar apenas se campos principais alterarem
    IF (NEW.date IS DISTINCT FROM OLD.date)
       OR (NEW.service_type IS DISTINCT FROM OLD.service_type)
       OR (NEW.client_id IS DISTINCT FROM OLD.client_id)
       OR (NEW.assigned_users IS DISTINCT FROM OLD.assigned_users)
       OR (NEW.notes IS DISTINCT FROM OLD.notes)
       OR (NEW.hectares IS DISTINCT FROM OLD.hectares)
       OR (NEW.value_per_hectare IS DISTINCT FROM OLD.value_per_hectare)
       OR (NEW.fixed_value IS DISTINCT FROM OLD.fixed_value) THEN

      SELECT contact_name, seller_auth_id INTO v_client_name, v_seller_auth_id
      FROM public.clients
      WHERE id = NEW.client_id;

      v_service_label := CASE NEW.service_type
        WHEN 'maintenance' THEN 'Manutenção'
        WHEN 'revision' THEN 'Revisão'
        WHEN 'spraying' THEN 'Pulverização'
        ELSE NEW.service_type::text
      END;

      v_message := format('Cliente: %s • Data e Hora: %s',
        COALESCE(v_client_name, 'Cliente'),
        to_char(NEW.date, 'DD/MM/YYYY HH24:MI')
      );
      IF NEW.notes IS NOT NULL AND NEW.notes <> '' THEN
        v_message := v_message || format(' • Obs.: %s', NEW.notes);
      END IF;
      IF NEW.hectares IS NOT NULL THEN
        v_message := v_message || format(' • Hectares: %s ha', NEW.hectares);
      END IF;
      IF NEW.value_per_hectare IS NOT NULL THEN
        v_message := v_message || format(' • Valor/ha: R$ %s', format_currency(NEW.value_per_hectare));
      END IF;
      IF NEW.fixed_value IS NOT NULL THEN
        v_message := v_message || format(' • Valor fixo: R$ %s', format_currency(NEW.fixed_value));
      END IF;
      IF NEW.total_value IS NOT NULL THEN
        v_message := v_message || format(' • Total: R$ %s', format_currency(NEW.total_value));
      END IF;

      v_user_ids := ARRAY[]::UUID[];
      IF NEW.created_by IS NOT NULL THEN
        v_user_ids := array_append(v_user_ids, NEW.created_by);
      END IF;
      IF v_seller_auth_id IS NOT NULL AND NOT (v_seller_auth_id = ANY(v_user_ids)) THEN
        v_user_ids := array_append(v_user_ids, v_seller_auth_id);
      END IF;
      IF NEW.assigned_users IS NOT NULL THEN
        FOREACH v_user_id IN ARRAY NEW.assigned_users LOOP
          IF NOT (v_user_id = ANY(v_user_ids)) THEN
            v_user_ids := array_append(v_user_ids, v_user_id);
          END IF;
        END LOOP;
      END IF;

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
          v_message,
          'service_' || NEW.service_type::text
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Recriar função de demonstrações sem lógica de serviço indevida
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
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    SELECT contact_name, seller_auth_id, city, state
      INTO v_client_name, v_seller_auth_id, v_client_city, v_client_state
    FROM public.clients
    WHERE id = NEW.client_id;

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
    IF NEW.hectares IS NOT NULL THEN
      v_message := v_message || format(' • Hectares: %s ha', NEW.hectares);
    END IF;

    v_user_ids := ARRAY[]::UUID[];
    IF v_seller_auth_id IS NOT NULL THEN
      v_user_ids := array_append(v_user_ids, v_seller_auth_id);
    END IF;
    IF NEW.assigned_users IS NOT NULL THEN
      FOREACH v_user_id IN ARRAY NEW.assigned_users LOOP
        IF NOT (v_user_id = ANY(v_user_ids)) THEN
          v_user_ids := array_append(v_user_ids, v_user_id);
        END IF;
      END LOOP;
    END IF;

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
        v_message,
        'demonstration'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;