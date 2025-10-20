-- Enviar TODAS as notificações para o webhook via Edge Function
-- Atualiza a função notify_whatsapp_after_insert para chamar sempre

CREATE OR REPLACE FUNCTION public.notify_whatsapp_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Chamar edge function de forma assíncrona SEM filtro por categoria
  PERFORM net.http_post(
    url := 'https://hlyhgpjzosnxaxgpcayi.supabase.co/functions/v1/send-whatsapp-notification',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('notification_id', NEW.id)
  );

  RETURN NEW;
END;
$function$;