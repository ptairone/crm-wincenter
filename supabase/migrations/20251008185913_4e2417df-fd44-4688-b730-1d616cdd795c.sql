-- Adicionar valor 'canceled' ao enum commission_pay_status
-- Nota: Não podemos modificar valores existentes em enums do PostgreSQL,
-- então vamos adicionar o novo valor 'canceled' (com 1 'l')
ALTER TYPE commission_pay_status ADD VALUE IF NOT EXISTS 'canceled';

-- Atualizar a função de notificação de comissões para usar 'canceled' corretamente
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
        to_char(NEW.amount, 'FM999G999G999D00')
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
          to_char(NEW.amount, 'FM999G999G999D00')
        )
      );
    ELSIF NEW.pay_status = 'canceled' THEN
      PERFORM public.create_notification(
        NEW.seller_auth_id,
        'warning',
        'Comissão Cancelada',
        format('Comissão de R$ %s foi cancelada. %s', 
          to_char(NEW.amount, 'FM999G999G999D00'),
          COALESCE('Motivo: ' || NEW.notes, '')
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;