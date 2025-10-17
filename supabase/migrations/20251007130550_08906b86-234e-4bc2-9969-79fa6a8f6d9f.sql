-- Fase 1: Adicionar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_clients_seller ON public.clients(seller_auth_id);
CREATE INDEX IF NOT EXISTS idx_sales_seller ON public.sales(seller_auth_id);
CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON public.sales(sold_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_seller ON public.opportunities(seller_auth_id);
CREATE INDEX IF NOT EXISTS idx_commissions_seller ON public.commissions(seller_auth_id);
CREATE INDEX IF NOT EXISTS idx_visits_seller ON public.visits(seller_auth_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON public.sale_items(product_id);

-- Fase 2: Função para decrementar estoque ao criar item de venda
CREATE OR REPLACE FUNCTION public.decrement_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar se há estoque suficiente
  IF (SELECT stock FROM products WHERE id = NEW.product_id) < NEW.qty THEN
    RAISE EXCEPTION 'Estoque insuficiente para o produto';
  END IF;
  
  -- Decrementar estoque
  UPDATE products 
  SET stock = stock - NEW.qty 
  WHERE id = NEW.product_id;
  
  RETURN NEW;
END;
$$;

-- Fase 3: Função para restaurar estoque ao deletar item de venda
CREATE OR REPLACE FUNCTION public.increment_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Incrementar estoque de volta
  UPDATE products 
  SET stock = stock + OLD.qty 
  WHERE id = OLD.product_id;
  
  RETURN OLD;
END;
$$;

-- Fase 4: Função para ajustar estoque ao atualizar quantidade
CREATE OR REPLACE FUNCTION public.adjust_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se produto mudou, reverter estoque do produto antigo e decrementar do novo
  IF OLD.product_id != NEW.product_id THEN
    UPDATE products SET stock = stock + OLD.qty WHERE id = OLD.product_id;
    
    IF (SELECT stock FROM products WHERE id = NEW.product_id) < NEW.qty THEN
      RAISE EXCEPTION 'Estoque insuficiente para o produto';
    END IF;
    
    UPDATE products SET stock = stock - NEW.qty WHERE id = NEW.product_id;
  -- Se só a quantidade mudou, ajustar diferença
  ELSIF OLD.qty != NEW.qty THEN
    DECLARE
      diff INTEGER := NEW.qty - OLD.qty;
    BEGIN
      IF (SELECT stock FROM products WHERE id = NEW.product_id) < diff THEN
        RAISE EXCEPTION 'Estoque insuficiente para o produto';
      END IF;
      
      UPDATE products SET stock = stock - diff WHERE id = NEW.product_id;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fase 5: Criar triggers para controle automático de estoque
DROP TRIGGER IF EXISTS trg_sale_item_insert ON public.sale_items;
CREATE TRIGGER trg_sale_item_insert
  AFTER INSERT ON public.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_product_stock();

DROP TRIGGER IF EXISTS trg_sale_item_delete ON public.sale_items;
CREATE TRIGGER trg_sale_item_delete
  AFTER DELETE ON public.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_product_stock();

DROP TRIGGER IF EXISTS trg_sale_item_update ON public.sale_items;
CREATE TRIGGER trg_sale_item_update
  AFTER UPDATE ON public.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION public.adjust_product_stock();