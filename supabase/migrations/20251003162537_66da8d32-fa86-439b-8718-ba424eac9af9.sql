-- Adicionar o tipo 'technician' ao enum user_role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'technician';

-- Atualizar política de seleção de clients para incluir technician
DROP POLICY IF EXISTS "clients_select" ON public.clients;
CREATE POLICY "clients_select" 
ON public.clients 
FOR SELECT 
USING (
  is_admin() OR 
  (seller_auth_id = auth.uid()) OR 
  (owner_user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
);

-- Atualizar política IUD de clients para incluir technician
DROP POLICY IF EXISTS "clients_iud" ON public.clients;
CREATE POLICY "clients_iud" 
ON public.clients 
FOR ALL 
USING (
  is_admin() OR 
  (seller_auth_id = auth.uid()) OR 
  (owner_user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
)
WITH CHECK (
  is_admin() OR 
  (seller_auth_id = auth.uid()) OR 
  (owner_user_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
);

-- Atualizar políticas de demonstrations para incluir technician
DROP POLICY IF EXISTS "demo_seller_view" ON public.demonstrations;
CREATE POLICY "demo_seller_view" 
ON public.demonstrations 
FOR SELECT 
USING (
  (client_id IN (SELECT c.id FROM clients c WHERE c.seller_auth_id = auth.uid())) OR 
  (auth.uid() = ANY (assigned_users)) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
);

DROP POLICY IF EXISTS "demo_seller_insert" ON public.demonstrations;
CREATE POLICY "demo_seller_insert" 
ON public.demonstrations 
FOR INSERT 
WITH CHECK (
  (client_id IN (SELECT c.id FROM clients c WHERE c.seller_auth_id = auth.uid())) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
);

DROP POLICY IF EXISTS "demo_seller_update" ON public.demonstrations;
CREATE POLICY "demo_seller_update" 
ON public.demonstrations 
FOR UPDATE 
USING (
  (client_id IN (SELECT c.id FROM clients c WHERE c.seller_auth_id = auth.uid())) OR 
  (auth.uid() = ANY (assigned_users)) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
)
WITH CHECK (
  (client_id IN (SELECT c.id FROM clients c WHERE c.seller_auth_id = auth.uid())) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
);

DROP POLICY IF EXISTS "demo_seller_delete" ON public.demonstrations;
CREATE POLICY "demo_seller_delete" 
ON public.demonstrations 
FOR DELETE 
USING (
  (client_id IN (SELECT c.id FROM clients c WHERE c.seller_auth_id = auth.uid())) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
);

-- Atualizar políticas de visits para incluir technician
DROP POLICY IF EXISTS "visits_select" ON public.visits;
CREATE POLICY "visits_select" 
ON public.visits 
FOR SELECT 
USING (
  is_admin() OR 
  (seller_auth_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
);

DROP POLICY IF EXISTS "visits_iud" ON public.visits;
CREATE POLICY "visits_iud" 
ON public.visits 
FOR ALL 
USING (
  is_admin() OR 
  (seller_auth_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
)
WITH CHECK (
  is_admin() OR 
  (seller_auth_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
);

-- Atualizar políticas de opportunities para incluir technician
DROP POLICY IF EXISTS "opps_select" ON public.opportunities;
CREATE POLICY "opps_select" 
ON public.opportunities 
FOR SELECT 
USING (
  is_admin() OR 
  (seller_auth_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
);

DROP POLICY IF EXISTS "opps_iud" ON public.opportunities;
CREATE POLICY "opps_iud" 
ON public.opportunities 
FOR ALL 
USING (
  is_admin() OR 
  (seller_auth_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
)
WITH CHECK (
  is_admin() OR 
  (seller_auth_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
);

-- Atualizar políticas de sales para incluir technician
DROP POLICY IF EXISTS "sales_select" ON public.sales;
CREATE POLICY "sales_select" 
ON public.sales 
FOR SELECT 
USING (
  is_admin() OR 
  (seller_auth_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
);

DROP POLICY IF EXISTS "sales_iud" ON public.sales;
CREATE POLICY "sales_iud" 
ON public.sales 
FOR ALL 
USING (
  is_admin() OR 
  (seller_auth_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
)
WITH CHECK (
  is_admin() OR 
  (seller_auth_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
);

-- Atualizar políticas de commissions para incluir technician
DROP POLICY IF EXISTS "commissions_select" ON public.commissions;
CREATE POLICY "commissions_select" 
ON public.commissions 
FOR SELECT 
USING (
  is_admin() OR 
  (seller_auth_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
);

DROP POLICY IF EXISTS "commissions_iud" ON public.commissions;
CREATE POLICY "commissions_iud" 
ON public.commissions 
FOR ALL 
USING (
  is_admin() OR 
  (seller_auth_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
)
WITH CHECK (
  is_admin() OR 
  (seller_auth_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
);

-- Atualizar políticas de services para incluir technician
DROP POLICY IF EXISTS "services_seller_view" ON public.services;
CREATE POLICY "services_seller_view" 
ON public.services 
FOR SELECT 
USING (
  is_admin() OR 
  (client_id IN (SELECT clients.id FROM clients WHERE clients.seller_auth_id = auth.uid())) OR 
  (auth.uid() = ANY (assigned_users)) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
);

DROP POLICY IF EXISTS "services_seller_iud" ON public.services;
CREATE POLICY "services_seller_iud" 
ON public.services 
FOR ALL 
USING (
  is_admin() OR 
  (client_id IN (SELECT clients.id FROM clients WHERE clients.seller_auth_id = auth.uid())) OR 
  (auth.uid() = ANY (assigned_users)) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
)
WITH CHECK (
  is_admin() OR 
  (client_id IN (SELECT clients.id FROM clients WHERE clients.seller_auth_id = auth.uid())) OR 
  (auth.uid() = ANY (assigned_users)) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
);

-- Atualizar políticas de sale_items para incluir technician
DROP POLICY IF EXISTS "saleitems_select" ON public.sale_items;
CREATE POLICY "saleitems_select" 
ON public.sale_items 
FOR SELECT 
USING (
  is_admin() OR 
  (EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_items.sale_id AND s.seller_auth_id = auth.uid())) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
);

DROP POLICY IF EXISTS "saleitems_iud" ON public.sale_items;
CREATE POLICY "saleitems_iud" 
ON public.sale_items 
FOR ALL 
USING (
  is_admin() OR 
  (EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_items.sale_id AND s.seller_auth_id = auth.uid())) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
)
WITH CHECK (
  is_admin() OR 
  (EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_items.sale_id AND s.seller_auth_id = auth.uid())) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
);

-- Atualizar política de goals para incluir technician
DROP POLICY IF EXISTS "goals_select" ON public.goals;
CREATE POLICY "goals_select" 
ON public.goals 
FOR SELECT 
USING (
  is_admin() OR 
  (level = 'team') OR 
  ((level = 'seller') AND (seller_auth_id = auth.uid())) OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician')
);