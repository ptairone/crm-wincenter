-- Notificações de Tarefas: replicar lógica de demonstrações e serviços
-- Cria funções/trigger para enviar notificações na criação e conclusão de tarefas

-- Função: notificar na criação da tarefa
CREATE OR REPLACE FUNCTION public.trg_notify_task_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_ids UUID[];
  v_user_id UUID;
  v_client_name TEXT;
  v_type_label TEXT;
BEGIN
  -- Buscar nome do cliente (se houver)
  IF NEW.client_id IS NOT NULL THEN
    SELECT contact_name INTO v_client_name
    FROM public.clients
    WHERE id = NEW.client_id;
  END IF;

  -- Mapear tipo para label em português
  v_type_label := CASE NEW.type
    WHEN 'schedule_visit' THEN 'Agendar Visita'
    WHEN 'stock_replenish' THEN 'Reposição de Estoque'
    WHEN 'service_precheck' THEN 'Pré-checagem de Serviço'
    WHEN 'service_execution' THEN 'Execução de Serviço'
    WHEN 'service_report' THEN 'Relatório de Serviço'
    WHEN 'demo_prepare' THEN 'Preparar Demonstração'
    WHEN 'demo_execution' THEN 'Executar Demonstração'
    WHEN 'demo_followup' THEN 'Follow-up de Demonstração'
    WHEN 'followup' THEN 'Follow-up'
    ELSE NEW.type::text
  END;

  -- Destinatários: responsável + usuários atribuídos (sem duplicatas)
  v_user_ids := ARRAY[]::UUID[];
  IF NEW.responsible_auth_id IS NOT NULL THEN
    v_user_ids := array_append(v_user_ids, NEW.responsible_auth_id);
  END IF;
  IF NEW.assigned_users IS NOT NULL THEN
    FOREACH v_user_id IN ARRAY NEW.assigned_users LOOP
      IF NOT (v_user_id = ANY (v_user_ids)) THEN
        v_user_ids := array_append(v_user_ids, v_user_id);
      END IF;
    END LOOP;
  END IF;

  -- Criar notificação para cada usuário
  FOREACH v_user_id IN ARRAY v_user_ids LOOP
    INSERT INTO public.notifications (
      user_auth_id,
      kind,
      title,
      message,
      category
    ) VALUES (
      v_user_id,
      'info',
      'Nova Tarefa 📝',
      format('%s%s com vencimento em %s',
        v_type_label,
        CASE WHEN NEW.client_id IS NOT NULL THEN ' para Cliente' ELSE '' END,
        to_char(NEW.due_at, 'DD/MM/YYYY HH24:MI')
      ),
      'task'
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Função: notificar na conclusão da tarefa
CREATE OR REPLACE FUNCTION public.trg_notify_task_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_ids UUID[];
  v_user_id UUID;
  v_client_name TEXT;
  v_type_label TEXT;
BEGIN
  -- Apenas quando status muda para 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    -- Buscar nome do cliente (se houver)
    IF NEW.client_id IS NOT NULL THEN
      SELECT contact_name INTO v_client_name
      FROM public.clients
      WHERE id = NEW.client_id;
    END IF;

    -- Mapear tipo para label em português
    v_type_label := CASE NEW.type
      WHEN 'schedule_visit' THEN 'Agendar Visita'
      WHEN 'stock_replenish' THEN 'Reposição de Estoque'
      WHEN 'service_precheck' THEN 'Pré-checagem de Serviço'
      WHEN 'service_execution' THEN 'Execução de Serviço'
      WHEN 'service_report' THEN 'Relatório de Serviço'
      WHEN 'demo_prepare' THEN 'Preparar Demonstração'
      WHEN 'demo_execution' THEN 'Executar Demonstração'
      WHEN 'demo_followup' THEN 'Follow-up de Demonstração'
      WHEN 'followup' THEN 'Follow-up'
      ELSE NEW.type::text
    END;

    -- Destinatários: responsável + usuários atribuídos (sem duplicatas)
    v_user_ids := ARRAY[]::UUID[];
    IF NEW.responsible_auth_id IS NOT NULL THEN
      v_user_ids := array_append(v_user_ids, NEW.responsible_auth_id);
    END IF;
    IF NEW.assigned_users IS NOT NULL THEN
      FOREACH v_user_id IN ARRAY NEW.assigned_users LOOP
        IF NOT (v_user_id = ANY (v_user_ids)) THEN
          v_user_ids := array_append(v_user_ids, v_user_id);
        END IF;
      END LOOP;
    END IF;

    -- Criar notificação para cada usuário
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
        'Tarefa Concluída ✅',
        format('%s%s concluída.',
          v_type_label,
          CASE WHEN NEW.client_id IS NOT NULL THEN format(' para %s', COALESCE(v_client_name, 'Cliente')) ELSE '' END
        ),
        'task'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- Triggers: criação e atualização de tarefas
DROP TRIGGER IF EXISTS trg_notify_task_insert ON public.tasks;
CREATE TRIGGER trg_notify_task_insert
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_task_insert();

DROP TRIGGER IF EXISTS trg_notify_task_update ON public.tasks;
CREATE TRIGGER trg_notify_task_update
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_task_update();