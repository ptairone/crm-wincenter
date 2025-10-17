-- Add foreign key constraints for proper JOIN in clients query
-- These reference users.auth_user_id to get seller/owner names

-- First check if constraints already exist, drop if needed
ALTER TABLE public.clients 
DROP CONSTRAINT IF EXISTS clients_owner_user_id_fkey,
DROP CONSTRAINT IF EXISTS clients_seller_auth_id_fkey;

-- Add foreign keys referencing users.auth_user_id
ALTER TABLE public.clients
ADD CONSTRAINT clients_owner_user_id_fkey 
FOREIGN KEY (owner_user_id) 
REFERENCES users(auth_user_id) 
ON DELETE SET NULL;

ALTER TABLE public.clients
ADD CONSTRAINT clients_seller_auth_id_fkey 
FOREIGN KEY (seller_auth_id) 
REFERENCES users(auth_user_id) 
ON DELETE CASCADE;