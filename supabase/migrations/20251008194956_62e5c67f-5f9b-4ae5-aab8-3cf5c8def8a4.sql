-- Remove triggers e funções de notificação para demonstrações e serviços
DROP FUNCTION IF EXISTS public.trg_notify_demonstration() CASCADE;
DROP FUNCTION IF EXISTS public.trg_notify_service() CASCADE;