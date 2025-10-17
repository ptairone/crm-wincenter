-- Adicionar campos de margem, imposto e markup na tabela products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS profit_margin_percent numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_percent numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pricing_mode text DEFAULT 'manual' CHECK (pricing_mode IN ('manual', 'calculated'));

-- Criar tabela para histórico de alterações de preço e custo
CREATE TABLE IF NOT EXISTS public.product_price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users(id),
  change_type text NOT NULL CHECK (change_type IN ('cost', 'price', 'both')),
  old_cost numeric,
  new_cost numeric,
  old_price numeric,
  new_price numeric,
  profit_margin_percent numeric,
  tax_percent numeric,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS na tabela de histórico
ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;

-- Política para admins poderem ver e inserir histórico
CREATE POLICY "price_history_admin_all"
ON public.product_price_history
FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Política para usuários autenticados verem histórico
CREATE POLICY "price_history_read_authenticated"
ON public.product_price_history
FOR SELECT
TO authenticated
USING (true);

-- Criar índice para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_product_price_history_product_id 
ON public.product_price_history(product_id);

CREATE INDEX IF NOT EXISTS idx_product_price_history_created_at 
ON public.product_price_history(created_at DESC);

-- Comentários para documentação
COMMENT ON TABLE public.product_price_history IS 'Histórico de alterações de preço e custo de produtos';
COMMENT ON COLUMN public.products.profit_margin_percent IS 'Margem de lucro em porcentagem';
COMMENT ON COLUMN public.products.tax_percent IS 'Porcentagem de impostos aplicados';
COMMENT ON COLUMN public.products.pricing_mode IS 'Modo de precificação: manual ou calculated (automático)';