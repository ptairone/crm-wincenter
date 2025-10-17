-- Add product_ids array to opportunities table
ALTER TABLE opportunities 
ADD COLUMN product_ids uuid[] DEFAULT ARRAY[]::uuid[];

-- Add comment
COMMENT ON COLUMN opportunities.product_ids IS 'Array of product IDs associated with this opportunity';