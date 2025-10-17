-- Adicionar novos valores ao enum demo_status
ALTER TYPE demo_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE demo_status ADD VALUE IF NOT EXISTS 'cancelled';