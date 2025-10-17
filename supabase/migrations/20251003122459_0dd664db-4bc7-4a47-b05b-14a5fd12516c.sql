-- Expandir enum commission_base para incluir tipos de serviços
ALTER TYPE commission_base ADD VALUE IF NOT EXISTS 'maintenance';
ALTER TYPE commission_base ADD VALUE IF NOT EXISTS 'revision';
ALTER TYPE commission_base ADD VALUE IF NOT EXISTS 'spraying';

-- Adicionar campos de pagamento na tabela sales
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS payment_method_1 TEXT,
ADD COLUMN IF NOT EXISTS payment_method_2 TEXT,
ADD COLUMN IF NOT EXISTS payment_received BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id) ON DELETE SET NULL;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_sales_service_id ON sales(service_id);

-- Comentários para documentação
COMMENT ON COLUMN sales.payment_method_1 IS 'Primeira forma de pagamento: Dinheiro, Pix, Financiamento, Cheque';
COMMENT ON COLUMN sales.payment_method_2 IS 'Segunda forma de pagamento opcional';
COMMENT ON COLUMN sales.payment_received IS 'Indica se o pagamento foi recebido';
COMMENT ON COLUMN sales.service_id IS 'Referência ao serviço técnico quando a venda é gerada automaticamente de um serviço';