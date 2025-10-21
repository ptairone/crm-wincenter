-- Add photos array column to services for storing image paths
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT ARRAY[]::text[];