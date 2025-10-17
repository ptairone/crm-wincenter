-- Remover função duplicada create_notification (versão sem category)
-- Manter apenas a versão com category que é mais completa
DROP FUNCTION IF EXISTS public.create_notification(uuid, notification_kind, text, text);

-- A função com category já existe e será mantida:
-- public.create_notification(p_user_auth_id uuid, p_kind notification_kind, p_title text, p_message text, p_category text DEFAULT NULL)