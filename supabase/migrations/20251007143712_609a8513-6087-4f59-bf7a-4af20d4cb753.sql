-- Limpar enum demo_status e service_status removendo valores obsoletos

-- 1. Remover defaults temporariamente
ALTER TABLE demonstrations ALTER COLUMN status DROP DEFAULT;
ALTER TABLE services ALTER COLUMN status DROP DEFAULT;

-- 2. Atualizar registros existentes com valores antigos
UPDATE demonstrations 
SET status = 'completed'::demo_status 
WHERE status = 'done'::demo_status;

UPDATE demonstrations 
SET status = 'cancelled'::demo_status 
WHERE status = 'canceled'::demo_status;

-- 3. Criar novos enums apenas com valores corretos
CREATE TYPE demo_status_new AS ENUM ('scheduled', 'completed', 'cancelled');
CREATE TYPE service_status_new AS ENUM ('scheduled', 'completed', 'cancelled');

-- 4. Alterar colunas para usar os novos enums
ALTER TABLE demonstrations 
  ALTER COLUMN status TYPE demo_status_new 
  USING status::text::demo_status_new;

ALTER TABLE services 
  ALTER COLUMN status TYPE service_status_new 
  USING status::text::service_status_new;

-- 5. Remover enums antigos e renomear os novos
DROP TYPE demo_status;
DROP TYPE service_status;
ALTER TYPE demo_status_new RENAME TO demo_status;
ALTER TYPE service_status_new RENAME TO service_status;

-- 6. Restaurar defaults
ALTER TABLE demonstrations ALTER COLUMN status SET DEFAULT 'scheduled'::demo_status;
ALTER TABLE services ALTER COLUMN status SET DEFAULT 'scheduled'::service_status;