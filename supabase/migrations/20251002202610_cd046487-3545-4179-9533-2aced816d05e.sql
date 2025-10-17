-- Atualizar política RLS para permitir vendedores verem clientes onde são responsáveis
DROP POLICY IF EXISTS "clients_select" ON public.clients;

CREATE POLICY "clients_select" 
ON public.clients 
FOR SELECT 
USING (
  is_admin() OR 
  (seller_auth_id = auth.uid()) OR 
  (owner_user_id = auth.uid())
);

-- Atualizar política de modificação também
DROP POLICY IF EXISTS "clients_iud" ON public.clients;

CREATE POLICY "clients_iud" 
ON public.clients 
FOR ALL 
USING (
  is_admin() OR 
  (seller_auth_id = auth.uid()) OR 
  (owner_user_id = auth.uid())
)
WITH CHECK (
  is_admin() OR 
  (seller_auth_id = auth.uid()) OR 
  (owner_user_id = auth.uid())
);