-- Corrigir constraint de scope para aceitar 'general' em vez de 'global'

-- 1. Remover constraint antiga
ALTER TABLE commission_rules DROP CONSTRAINT IF EXISTS commission_rules_scope_check;

-- 2. Criar nova constraint com 'general' em vez de 'global'
ALTER TABLE commission_rules ADD CONSTRAINT commission_rules_scope_check CHECK (
  (scope = 'general' AND category IS NULL AND product_id IS NULL) OR
  (scope = 'category' AND category IS NOT NULL AND product_id IS NULL) OR
  (scope = 'product' AND product_id IS NOT NULL AND category IS NULL)
);