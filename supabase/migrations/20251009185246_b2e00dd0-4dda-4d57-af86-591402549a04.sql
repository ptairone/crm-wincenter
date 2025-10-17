-- Corrigir função trg_notify_service para calcular total_value manualmente
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
  v_total_value NUMERIC;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    SELECT contact_name INTO v_client_name
    FROM public.clients
    WHERE id = NEW.client_id;
    
    -- Calcular total_value manualmente em vez de usar NEW.total_value
    IF NEW.fixed_value IS NOT NULL THEN
      v_total_value := NEW.fixed_value;
    ELSIF NEW.hectares IS NOT NULL AND NEW.value_per_hectare IS NOT NULL THEN
      v_total_value := NEW.hectares * NEW.value_per_hectare;
    ELSE
      v_total_value := 0;
    END IF;
    
    v_service_label := CASE NEW.service_type
      WHEN 'maintenance' THEN 'Manutenção'
      WHEN 'revision' THEN 'Revisão'
      WHEN 'spraying' THEN 'Pulverização'
      ELSE NEW.service_type::text
    END;
    
    v_user_ids := ARRAY[]::UUID[];
    
    IF NEW.created_by IS NOT NULL THEN
      v_user_ids := array_append(v_user_ids, NEW.created_by);
    END IF;
    
    SELECT seller_auth_id INTO v_user_id
    FROM public.clients
    WHERE id = NEW.client_id;
    
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
          format_currency(COALESCE(v_total_value, 0))
        ),
        'service_' || NEW.service_type::text
      );
    END LOOP;
    
  END IF;
  
  RETURN NEW;
END;
$function$;