-- Criar tabela de tarefas (tasks) focada em rotina diária
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  client_id UUID NULL REFERENCES public.clients(id) ON DELETE SET NULL,
  related_entity_id UUID NULL,
  assigned_users UUID[] DEFAULT ARRAY[]::uuid[],
  responsible_auth_id UUID NULL,
  due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Restrições de domínio simples
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_type_check CHECK (type IN (
    'schedule_visit',
    'stock_replenish',
    'service_precheck',
    'service_execution',
    'service_report',
    'demo_prepare',
    'demo_execution',
    'demo_followup',
    'followup'
  ));

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check CHECK (status IN ('pending','in_progress','completed','cancelled'));

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_priority_check CHECK (priority IN ('low','medium','high'));

-- Índice para evitar duplicidade de tarefas por entidade/data
CREATE INDEX IF NOT EXISTS idx_tasks_related_due ON public.tasks (type, related_entity_id, due_at);

-- Habilitar RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
DROP POLICY IF EXISTS tasks_select ON public.tasks;
CREATE POLICY tasks_select ON public.tasks
  FOR SELECT
  USING (
    is_admin() OR
    (responsible_auth_id = auth.uid()) OR
    (auth.uid() = ANY (assigned_users)) OR
    (client_id IN (SELECT c.id FROM public.clients c WHERE c.seller_auth_id = auth.uid()))
  );


DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks
  FOR INSERT
  WITH CHECK (
    is_admin() OR
    (responsible_auth_id = auth.uid()) OR
    (auth.uid() = ANY (assigned_users)) OR
    (client_id IN (SELECT c.id FROM public.clients c WHERE c.seller_auth_id = auth.uid()))
  );

DROP POLICY IF EXISTS tasks_update ON public.tasks;
CREATE POLICY tasks_update ON public.tasks
  FOR UPDATE
  USING (
    is_admin() OR
    (responsible_auth_id = auth.uid()) OR
    (auth.uid() = ANY (assigned_users)) OR
    (client_id IN (SELECT c.id FROM public.clients c WHERE c.seller_auth_id = auth.uid()))
  )
  WITH CHECK (
    is_admin() OR
    (responsible_auth_id = auth.uid()) OR
    (auth.uid() = ANY (assigned_users)) OR
    (client_id IN (SELECT c.id FROM public.clients c WHERE c.seller_auth_id = auth.uid()))
  );

DROP POLICY IF EXISTS tasks_delete ON public.tasks;
CREATE POLICY tasks_delete ON public.tasks
  FOR DELETE
  USING (
    is_admin() OR
    (responsible_auth_id = auth.uid()) OR
    (auth.uid() = ANY (assigned_users))
  );

-- Função utilitária para criação de tarefas (evita duplicados por tipo/entidade/data)
DROP FUNCTION IF EXISTS public.create_task(UUID, TEXT, UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, UUID[]);
CREATE OR REPLACE FUNCTION public.create_task(
  p_responsible_auth_id UUID,
  p_type TEXT,
  p_client_id UUID,
  p_related_entity_id UUID,
  p_due_at TIMESTAMPTZ,
  p_priority TEXT,
  p_notes TEXT,
  p_assigned_users UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_task_id UUID;
BEGIN
  -- Verificar se já existe tarefa semelhante
  SELECT id INTO v_task_id
  FROM public.tasks
  WHERE type = p_type
    AND (p_related_entity_id IS NOT NULL AND related_entity_id = p_related_entity_id)
    AND (date_trunc('day', due_at) = date_trunc('day', COALESCE(p_due_at, now())));

  IF v_task_id IS NOT NULL THEN
    RETURN v_task_id;
  END IF;

  INSERT INTO public.tasks (
    responsible_auth_id, type, client_id, related_entity_id, due_at, priority, notes, assigned_users, status
  ) VALUES (
    p_responsible_auth_id,
    p_type,
    p_client_id,
    p_related_entity_id,
    COALESCE(p_due_at, now()),
    COALESCE(p_priority, 'medium'),
    p_notes,
    COALESCE(p_assigned_users, ARRAY[]::uuid[]),
    'pending'
  )
  RETURNING id INTO v_task_id;

  RETURN v_task_id;
END;
$$;

COMMENT ON TABLE public.tasks IS 'Tarefas operacionais do dia a dia (visitas, serviços, demos, estoque)';
COMMENT ON FUNCTION public.create_task(UUID, TEXT, UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, UUID[]) IS 'Cria tarefa evitando duplicações para o mesmo tipo/entidade/data.';