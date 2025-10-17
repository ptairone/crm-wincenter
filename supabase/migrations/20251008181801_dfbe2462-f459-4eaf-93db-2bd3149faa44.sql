-- Corrigir política RLS que causava recursão infinita
-- A política anterior fazia uma subquery na própria tabela users, causando recursão
DROP POLICY IF EXISTS "users_select_self_or_admin" ON public.users;

-- Permitir que todos os usuários autenticados vejam a tabela users
-- Isso é necessário para o CRM funcionar (mostrar responsáveis, vendedores, etc.)
CREATE POLICY "users_select_authenticated"
ON public.users
FOR SELECT
TO authenticated
USING (true);