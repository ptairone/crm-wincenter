-- Atualizar política RLS para permitir técnicos verem usuários responsáveis
DROP POLICY IF EXISTS "users_select_self_or_admin" ON public.users;

CREATE POLICY "users_select_self_or_admin"
ON public.users
FOR SELECT
TO authenticated
USING (
  is_admin() 
  OR (auth.uid() = auth_user_id)
  OR EXISTS (
    SELECT 1 FROM users u
    WHERE u.auth_user_id = auth.uid()
    AND u.role = 'technician'
  )
);