-- Expand demonstrations table with new fields
-- Add multiple responsibles, products, demo types, crop, and hectares

-- First, drop the RLS policies that depend on assigned_user column
DROP POLICY IF EXISTS demo_seller_view ON public.demonstrations;
DROP POLICY IF EXISTS demo_tech_view ON public.demonstrations;

-- Add new columns
ALTER TABLE public.demonstrations
ADD COLUMN IF NOT EXISTS assigned_users uuid[] DEFAULT ARRAY[]::uuid[],
ADD COLUMN IF NOT EXISTS products uuid[] DEFAULT ARRAY[]::uuid[],
ADD COLUMN IF NOT EXISTS demo_types text[] DEFAULT ARRAY[]::text[],
ADD COLUMN IF NOT EXISTS crop text,
ADD COLUMN IF NOT EXISTS hectares numeric;

-- Migrate existing assigned_user to assigned_users array
UPDATE public.demonstrations
SET assigned_users = ARRAY[assigned_user]
WHERE assigned_user IS NOT NULL AND assigned_users = ARRAY[]::uuid[];

-- Now drop the old assigned_user column
ALTER TABLE public.demonstrations
DROP COLUMN IF EXISTS assigned_user;

-- Recreate RLS policies using assigned_users array
CREATE POLICY "demo_seller_view" 
ON public.demonstrations 
FOR SELECT 
USING (
  (client_id IN ( 
    SELECT c.id
    FROM clients c
    WHERE (c.seller_auth_id = auth.uid())
  )) 
  OR auth.uid() = ANY(assigned_users)
);

CREATE POLICY "demo_tech_view" 
ON public.demonstrations 
FOR SELECT 
USING (auth.uid() = ANY(assigned_users));

-- Add comments for clarity
COMMENT ON COLUMN public.demonstrations.assigned_users IS 'Array of user IDs (technicians/sellers) responsible for the demonstration';
COMMENT ON COLUMN public.demonstrations.products IS 'Array of product IDs used in the demonstration';
COMMENT ON COLUMN public.demonstrations.demo_types IS 'Types of demonstration: semeadura, herbicida, inseticida, fungicida';
COMMENT ON COLUMN public.demonstrations.crop IS 'Crop/culture for the demonstration';
COMMENT ON COLUMN public.demonstrations.hectares IS 'Area in hectares for the demonstration';