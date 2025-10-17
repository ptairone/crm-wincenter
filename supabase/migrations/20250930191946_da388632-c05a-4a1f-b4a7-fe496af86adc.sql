-- Add status field to visits table
DO $$ BEGIN
  CREATE TYPE visit_status AS ENUM ('scheduled', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE visits 
ADD COLUMN IF NOT EXISTS status visit_status NOT NULL DEFAULT 'scheduled';

-- Update existing visits based on scheduled_at
UPDATE visits 
SET status = CASE 
  WHEN scheduled_at IS NULL OR scheduled_at <= NOW() THEN 'completed'::visit_status
  ELSE 'scheduled'::visit_status
END
WHERE status = 'scheduled';