-- Add 'invited' value to user_status enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'invited' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_status')
    ) THEN
        ALTER TYPE user_status ADD VALUE 'invited';
    END IF;
END $$;