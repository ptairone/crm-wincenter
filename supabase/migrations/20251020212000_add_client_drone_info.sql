-- Create table for per-client drone synchronization info
CREATE TABLE IF NOT EXISTS public.client_drone_info (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  name text,
  login text,
  password text,
  controller_serial text,
  drone_serial text,
  controller_version text,
  drone_version text,
  purchase_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_drone_info ENABLE ROW LEVEL SECURITY;

-- Policies: mirror access of the related client (seller, owner, or admin)
DROP POLICY IF EXISTS "drone_info_select" ON public.client_drone_info;
CREATE POLICY "drone_info_select"
ON public.client_drone_info
FOR SELECT
USING (
  is_admin() OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician') OR
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_drone_info.client_id
      AND (
        c.seller_auth_id = auth.uid() OR
        c.owner_user_id = auth.uid()
      )
  )
);

DROP POLICY IF EXISTS "drone_info_iud" ON public.client_drone_info;
CREATE POLICY "drone_info_iud"
ON public.client_drone_info
FOR ALL
USING (
  is_admin() OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician') OR
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_drone_info.client_id
      AND (
        c.seller_auth_id = auth.uid() OR
        c.owner_user_id = auth.uid()
      )
  )
)
WITH CHECK (
  is_admin() OR
  EXISTS (SELECT 1 FROM public.users WHERE auth_user_id = auth.uid() AND role = 'technician') OR
  EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = client_drone_info.client_id
      AND (
        c.seller_auth_id = auth.uid() OR
        c.owner_user_id = auth.uid()
      )
  )
);

-- Helpful index in case primary key is changed later (no-op if PK remains)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'idx_client_drone_info_client_id'
  ) THEN
    CREATE INDEX idx_client_drone_info_client_id
      ON public.client_drone_info (client_id);
  END IF;
END $$;