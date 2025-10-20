-- Patch: padroniza deduplicação por cliente/relacionado e nunca lança erro
-- A função retorna o id da tarefa existente quando há duplicidade no mesmo dia

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
  -- Tenta localizar tarefa semelhante pelo mesmo tipo e dia
  SELECT id INTO v_task_id
  FROM public.tasks
  WHERE type = p_type
    AND date_trunc('day', due_at) = date_trunc('day', COALESCE(p_due_at, now()))
    AND (
      (p_related_entity_id IS NOT NULL AND related_entity_id = p_related_entity_id)
      OR (p_related_entity_id IS NULL AND p_client_id IS NOT NULL AND client_id = p_client_id)
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_task_id IS NOT NULL THEN
    RETURN v_task_id; -- Deduplica sem erro
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