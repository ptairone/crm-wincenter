-- Corrigir formatação de valores monetários nas notificações

-- Função auxiliar para formatar valores em Real brasileiro
CREATE OR REPLACE FUNCTION format_currency(amount NUMERIC)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN REPLACE(REPLACE(TO_CHAR(amount, 'FM999G999G990D00'), 'G', '.'), 'D', ',');
END;
$$;

-- Atualizar função de notificação de comissões
CREATE OR REPLACE FUNCTION public.trg_notify_commission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- INSERT: Nova comissão criada
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_notification(
      NEW.seller_auth_id,
      'success',
      'Nova Comissão Gerada! 💰',
      format('Comissão de R$ %s gerada com sucesso!', 
        format_currency(NEW.amount)
      )
    );
  END IF;
  
  -- UPDATE: Mudança de status de pagamento
  IF TG_OP = 'UPDATE' AND OLD.pay_status != NEW.pay_status THEN
    IF NEW.pay_status = 'paid' THEN
      PERFORM public.create_notification(
        NEW.seller_auth_id,
        'success',
        'Comissão Paga! 🎉',
        format('Sua comissão de R$ %s foi paga!', 
          format_currency(NEW.amount)
        )
      );
    ELSIF NEW.pay_status = 'canceled' THEN
      PERFORM public.create_notification(
        NEW.seller_auth_id,
        'warning',
        'Comissão Cancelada',
        format('Comissão de R$ %s foi cancelada. %s', 
          format_currency(NEW.amount),
          COALESCE('Motivo: ' || NEW.notes, '')
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Atualizar função de notificação de vendas
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
  -- Apenas notificar quando venda é criada (INSERT)
  IF TG_OP = 'INSERT' AND NEW.status = 'closed' THEN
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
      )
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
        )
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Atualizar função de notificação de oportunidades
CREATE OR REPLACE FUNCTION public.trg_notify_opportunity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        format_currency(COALESCE(NEW.gross_value, 0))
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
            format_currency(COALESCE(NEW.gross_value, 0)),
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
$function$;