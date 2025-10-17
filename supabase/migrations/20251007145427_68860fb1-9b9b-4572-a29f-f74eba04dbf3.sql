-- Atualizar políticas RLS para técnicos verem apenas seus próprios registros

-- 1. Atualizar políticas de SALES
DROP POLICY IF EXISTS "sales_select" ON public.sales;
DROP POLICY IF EXISTS "sales_iud" ON public.sales;

CREATE POLICY "sales_select" 
ON public.sales 
FOR SELECT 
USING (
  is_admin() 
  OR (seller_auth_id = auth.uid())
);

CREATE POLICY "sales_iud" 
ON public.sales 
FOR ALL 
USING (
  is_admin() 
  OR (seller_auth_id = auth.uid())
)
WITH CHECK (
  is_admin() 
  OR (seller_auth_id = auth.uid())
);

-- 2. Atualizar políticas de OPPORTUNITIES
DROP POLICY IF EXISTS "opps_select" ON public.opportunities;
DROP POLICY IF EXISTS "opps_iud" ON public.opportunities;

CREATE POLICY "opps_select" 
ON public.opportunities 
FOR SELECT 
USING (
  is_admin() 
  OR (seller_auth_id = auth.uid())
);

CREATE POLICY "opps_iud" 
ON public.opportunities 
FOR ALL 
USING (
  is_admin() 
  OR (seller_auth_id = auth.uid())
)
WITH CHECK (
  is_admin() 
  OR (seller_auth_id = auth.uid())
);

-- 3. Atualizar políticas de COMMISSIONS
DROP POLICY IF EXISTS "commissions_select" ON public.commissions;
DROP POLICY IF EXISTS "commissions_iud" ON public.commissions;

CREATE POLICY "commissions_select" 
ON public.commissions 
FOR SELECT 
USING (
  is_admin() 
  OR (seller_auth_id = auth.uid())
);

CREATE POLICY "commissions_iud" 
ON public.commissions 
FOR ALL 
USING (
  is_admin() 
  OR (seller_auth_id = auth.uid())
)
WITH CHECK (
  is_admin() 
  OR (seller_auth_id = auth.uid())
);