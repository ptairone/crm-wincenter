-- Adicionar coluna client_id às notificações e atualizar create_notification

-- 1) Adicionar coluna client_id (nullable) e FK para clients(id)
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS client_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'notifications_client_id_fkey'
      AND table_name = 'notifications'
      AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_client_id_fkey
      FOREIGN KEY (client_id)
      REFERENCES public.clients (id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 2) Atualizar função create_notification para aceitar p_client_id opcional
-- Mantém compatibilidade: novos parâmetro tem DEFAULT NULL e ficam ao final
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_auth_id uuid,
  p_kind notification_kind,
  p_title text,
  p_message text,
  p_category text DEFAULT NULL,
  p_client_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_notification_id uuid;
BEGIN
  INSERT INTO public.notifications (user_auth_id, kind, title, message, category, client_id)
  VALUES (p_user_auth_id, p_kind, p_title, p_message, p_category, p_client_id)
  RETURNING id INTO v_notification_id;
  RETURN v_notification_id;
END;
$function$;