-- Adicionar campo para motivo de cancelamento nas demonstrações
ALTER TABLE demonstrations 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Adicionar campo para motivo de cancelamento nos serviços
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;