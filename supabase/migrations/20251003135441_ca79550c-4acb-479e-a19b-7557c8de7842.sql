-- Adicionar novos valores ao enum commission_base
ALTER TYPE commission_base ADD VALUE IF NOT EXISTS 'maintenance';
ALTER TYPE commission_base ADD VALUE IF NOT EXISTS 'revision';
ALTER TYPE commission_base ADD VALUE IF NOT EXISTS 'spraying';