-- Aprimora a mensagem das notificações de tarefas (inserção)
-- Alinha o conteúdo com o padrão rico usado em demonstrações/serviços

CREATE OR REPLACE FUNCTION public.trg_notify_task_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_ids UUID[];
  v_user_id UUID;
  v_client_name TEXT;
  v_type_label TEXT;
  v_message TEXT;
  v_priority_label TEXT;
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

  -- Montar mensagem rica com detalhes relevantes
  v_message := format('%s%s • Vencimento: %s',
    v_type_label,
    CASE WHEN NEW.client_id IS NOT NULL THEN format(' para %s', COALESCE(v_client_name, 'Cliente')) ELSE '' END,
    to_char(NEW.due_at, 'DD/MM/YYYY HH24:MI')
  );

  IF NEW.priority IS NOT NULL THEN
    v_priority_label := CASE NEW.priority
      WHEN 'high' THEN 'Alta'
      WHEN 'medium' THEN 'Média'
      WHEN 'low' THEN 'Baixa'
      ELSE NEW.priority
    END;
    v_message := v_message || format(' • Prioridade: %s', v_priority_label);
  END IF;

  IF NEW.notes IS NOT NULL AND NEW.notes <> '' THEN
    v_message := v_message || format(' • Obs.: %s', NEW.notes);
  END IF;

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
        category,
        client_id
      ) VALUES (
        v_user_id,
        'info',
        'Nova Tarefa 📝',
        v_message,
        'task',
        NEW.client_id
      );
  END LOOP;

  RETURN NEW;
END;
$$;