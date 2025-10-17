-- Adicionar política RLS para permitir admins deletarem usuários
CREATE POLICY "users_delete_admin" 
ON public.users 
FOR DELETE 
USING (is_admin());