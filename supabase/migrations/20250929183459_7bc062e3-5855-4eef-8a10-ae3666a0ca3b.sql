-- CRITICAL SECURITY FIXES

-- =====================================================================
-- FIX 1: Prevent Privilege Escalation in Users Table
-- =====================================================================
-- Drop the existing policy that allows users to update their own role
DROP POLICY IF EXISTS "users_update_self_or_admin" ON public.users;

-- Create separate policies for admins and self-updates
CREATE POLICY "users_update_admin_all"
ON public.users
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Users can only update safe fields (not role, status, auth_user_id)
CREATE POLICY "users_update_self_safe_fields"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = auth_user_id)
WITH CHECK (
  auth.uid() = auth_user_id
  AND role = (SELECT role FROM public.users WHERE auth_user_id = auth.uid())
  AND status = (SELECT status FROM public.users WHERE auth_user_id = auth.uid())
  AND auth_user_id = (SELECT auth_user_id FROM public.users WHERE auth_user_id = auth.uid())
);

-- =====================================================================
-- FIX 2: Restrict Commission Rules Access
-- =====================================================================
-- Drop the policy that exposes all commission rules
DROP POLICY IF EXISTS "commission_rules_read" ON public.commission_rules;

-- Only admins can read all commission rules
CREATE POLICY "commission_rules_read_admin"
ON public.commission_rules
FOR SELECT
TO authenticated
USING (is_admin());

-- Sellers can only see commission rules when they're actively creating/viewing their sales
-- This is intentionally restrictive - sellers shouldn't browse commission structures
-- They'll see commissions calculated in their actual commission records

-- =====================================================================
-- FIX 3: Fix SQL Injection Risk - Add secure search_path to functions
-- =====================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END$function$;

CREATE OR REPLACE FUNCTION public.recalc_sale_totals(p_sale uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  UPDATE public.sales s
  SET
    gross_value = COALESCE(t.sum_gross,0),
    total_cost  = COALESCE(t.sum_cost,0),
    estimated_profit = COALESCE(t.sum_gross,0) - COALESCE(t.sum_cost,0)
  FROM (
    SELECT
      si.sale_id,
      SUM((si.unit_price * si.qty) * (1 - si.discount_percent/100.0)) AS sum_gross,
      SUM(p.cost * si.qty) AS sum_cost
    FROM public.sale_items si
    JOIN public.products p ON p.id = si.product_id
    WHERE si.sale_id = p_sale
    GROUP BY si.sale_id
  ) t
  WHERE s.id = t.sale_id;
$function$;

CREATE OR REPLACE FUNCTION public.trg_after_saleitem()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  PERFORM public.recalc_sale_totals(COALESCE(NEW.sale_id, OLD.sale_id));
  RETURN NULL;
END$function$;

-- =====================================================================
-- FIX 4: Make clients.seller_auth_id NOT NULL for data integrity
-- =====================================================================
-- First, update any existing NULL records (if any) to be owned by the first admin
DO $$
DECLARE
  first_admin_id uuid;
BEGIN
  SELECT auth_user_id INTO first_admin_id 
  FROM public.users 
  WHERE role = 'admin' 
  ORDER BY created_at 
  LIMIT 1;
  
  IF first_admin_id IS NOT NULL THEN
    UPDATE public.clients 
    SET seller_auth_id = first_admin_id 
    WHERE seller_auth_id IS NULL;
  END IF;
END $$;

-- Now make the column NOT NULL
ALTER TABLE public.clients 
ALTER COLUMN seller_auth_id SET NOT NULL;