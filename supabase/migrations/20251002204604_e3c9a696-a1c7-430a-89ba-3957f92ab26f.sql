-- Remove incorrect foreign key constraint on clients.owner_user_id
-- The owner_user_id should reference auth.users.id directly, like seller_auth_id does
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_owner_user_id_fkey;