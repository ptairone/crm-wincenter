-- Corrigir trigger de oportunidades para evitar notificações duplicadas
-- quando o vendedor também é admin

CREATE OR REPLACE FUNCTION public.trg_notify_opportunity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name TEXT;
  v_admin_id UUID;
  v_stage_label TEXT;
BEGIN
  -- Buscar nome do cliente
  SELECT contact_name INTO v_client_name
  FROM public.clients
  WHERE id = COALESCE(NEW.client_id, OLD.client_id);
  
  -- INSERT: Nova oportunidade
  IF TG_OP = 'INSERT' THEN
    -- Notificar vendedor
    PERFORM public.create_notification(
      NEW.seller_auth_id,
      'info',
      'Nova Oportunidade Criada',
      format('Oportunidade para %s no valor de R$ %s criada', 
        COALESCE(v_client_name, 'Cliente'),
        COALESCE(to_char(NEW.gross_value, 'FM999G999G999D00'), '0,00')
      )
    );
    
    -- Notificar admins (EXCETO o vendedor se ele também for admin)
    FOR v_admin_id IN SELECT auth_user_id FROM public.get_admin_user_ids() LOOP
      IF v_admin_id != NEW.seller_auth_id THEN
        PERFORM public.create_notification(
          v_admin_id,
          'info',
          'Nova Oportunidade',
          format('Oportunidade de R$ %s para %s', 
            COALESCE(to_char(NEW.gross_value, 'FM999G999G999D00'), '0,00'),
            COALESCE(v_client_name, 'Cliente')
          )
        );
      END IF;
    END LOOP;
  END IF;
  
  -- UPDATE: Mudança de estágio
  IF TG_OP = 'UPDATE' AND OLD.stage != NEW.stage THEN
    -- Mapear estágios para labels
    v_stage_label := CASE NEW.stage
      WHEN 'qualification' THEN 'Qualificação'
      WHEN 'proposal' THEN 'Proposta'
      WHEN 'negotiation' THEN 'Negociação'
      WHEN 'won' THEN 'Ganha'
      WHEN 'lost' THEN 'Perdida'
      ELSE NEW.stage
    END;
    
    -- Notificar vendedor
    IF NEW.stage = 'won' THEN
      PERFORM public.create_notification(
        NEW.seller_auth_id,
        'success',
        'Oportunidade Ganha! 🎉',
        format('Parabéns! Oportunidade de %s foi convertida em venda!', 
          COALESCE(v_client_name, 'Cliente')
        )
      );
    ELSIF NEW.stage = 'lost' THEN
      PERFORM public.create_notification(
        NEW.seller_auth_id,
        'warning',
        'Oportunidade Perdida',
        format('Oportunidade de %s foi perdida. Motivo: %s', 
          COALESCE(v_client_name, 'Cliente'),
          COALESCE(NEW.loss_reason, 'Não informado')
        )
      );
    ELSE
      PERFORM public.create_notification(
        NEW.seller_auth_id,
        'success',
        'Oportunidade Avançou',
        format('Oportunidade de %s avançou para: %s', 
          COALESCE(v_client_name, 'Cliente'),
          v_stage_label
        )
      );
    END IF;
    
    -- Notificar admins (EXCETO o vendedor se ele também for admin)
    FOR v_admin_id IN SELECT auth_user_id FROM public.get_admin_user_ids() LOOP
      IF v_admin_id != NEW.seller_auth_id THEN
        PERFORM public.create_notification(
          v_admin_id,
          CASE WHEN NEW.stage = 'won' THEN 'success' 
               WHEN NEW.stage = 'lost' THEN 'warning' 
               ELSE 'info' END,
          format('Oportunidade: %s', v_stage_label),
          format('Oportunidade de %s agora está em: %s', 
            COALESCE(v_client_name, 'Cliente'),
            v_stage_label
          )
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Habilitar realtime para notificações
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER publication supabase_realtime ADD TABLE public.notifications;