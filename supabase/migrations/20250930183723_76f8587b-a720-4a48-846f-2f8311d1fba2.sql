-- Add location_link column to clients table
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS location_link text;