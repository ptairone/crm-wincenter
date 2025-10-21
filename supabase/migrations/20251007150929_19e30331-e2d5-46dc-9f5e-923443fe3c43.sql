-- Adicionar política RLS para permitir admins deletarem usuários
DROP POLICY IF EXISTS "users_delete_admin" ON public.users;
CREATE POLICY "users_delete_admin" 
ON public.users 
FOR DELETE 
USING (is_admin());