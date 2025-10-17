-- Criar triggers que faltam
CREATE TRIGGER trg_after_demonstration_update
  AFTER UPDATE ON public.demonstrations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_demonstration();

CREATE TRIGGER trg_after_service_update
  AFTER UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_service();

CREATE TRIGGER trg_after_service_complete_sale
  AFTER UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_service_completed_create_sale();

-- Corrigir função notify_whatsapp_after_insert removendo Authorization header e operador ->>
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
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('notification_id', NEW.id)
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Melhorar RLS policy para demonstrations - permitir assigned_users no WITH CHECK
DROP POLICY IF EXISTS demo_seller_update ON public.demonstrations;
CREATE POLICY demo_seller_update ON public.demonstrations
  FOR UPDATE
  USING (
    (client_id IN (SELECT c.id FROM clients c WHERE c.seller_auth_id = auth.uid())) 
    OR (auth.uid() = ANY (assigned_users)) 
    OR (EXISTS (SELECT 1 FROM users WHERE users.auth_user_id = auth.uid() AND users.role = 'technician'::user_role))
  )
  WITH CHECK (
    (client_id IN (SELECT c.id FROM clients c WHERE c.seller_auth_id = auth.uid()))
    OR (auth.uid() = ANY (assigned_users))
    OR (EXISTS (SELECT 1 FROM users WHERE users.auth_user_id = auth.uid() AND users.role = 'technician'::user_role))
  );

DROP POLICY IF EXISTS demo_seller_insert ON public.demonstrations;
CREATE POLICY demo_seller_insert ON public.demonstrations
  FOR INSERT
  WITH CHECK (
    (client_id IN (SELECT c.id FROM clients c WHERE c.seller_auth_id = auth.uid()))
    OR (EXISTS (SELECT 1 FROM users WHERE users.auth_user_id = auth.uid() AND users.role = 'technician'::user_role))
  );