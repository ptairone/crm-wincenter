-- Remove the public read policy that exposes product data
DROP POLICY IF EXISTS "products_read_all" ON public.products;

-- Create new policy: only authenticated users can read products
-- This protects sensitive pricing and cost data from competitors
CREATE POLICY "products_read_authenticated"
ON public.products
FOR SELECT
TO authenticated
USING (true);

-- Explanation:
-- - Sellers need to see products to create sales
-- - Admins need to see products for management (already have write access)
-- - Anonymous/public users are now blocked from accessing sensitive product data
-- - This prevents competitors from scraping pricing and cost information