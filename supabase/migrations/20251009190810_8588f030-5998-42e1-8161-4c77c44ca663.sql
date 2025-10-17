-- Remover triggers duplicados que estão causando notificações em dobro

-- Para demonstrations: remover trigger de INSERT (só queremos no UPDATE para 'completed')
DROP TRIGGER IF EXISTS trg_notify_demonstration ON public.demonstrations;

-- Para services: remover trigger de INSERT e trigger duplicado de UPDATE
DROP TRIGGER IF EXISTS trg_notify_service ON public.services;
DROP TRIGGER IF EXISTS trg_service_completed_create_sale ON public.services;

-- Os triggers corretos já existem:
-- trg_after_demonstration_update (UPDATE)
-- trg_after_service_update (UPDATE) 
-- trg_after_service_complete_sale (UPDATE)