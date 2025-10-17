-- =====================================================
-- SISTEMA COMPLETO DE NOTIFICAÇÕES
-- =====================================================

-- 1. Garantir que o enum notification_kind tem todos os valores necessários
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_kind') THEN
    CREATE TYPE notification_kind AS ENUM ('info', 'success', 'warning', 'alert');
  ELSE
    -- Adicionar valores que não existem
    BEGIN
      ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'info';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'success';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'warning';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS 'alert';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- 2. Função genérica para criar notificações
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_auth_id UUID,
  p_kind notification_kind,
  p_title TEXT,
  p_message TEXT
) RETURNS UUID 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (user_auth_id, kind, title, message)
  VALUES (p_user_auth_id, p_kind, p_title, p_message)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$;

-- 3. Função auxiliar para obter todos os admins
CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
RETURNS TABLE(auth_user_id UUID)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.auth_user_id 
  FROM public.users u
  WHERE u.role = 'admin' 
    AND u.status = 'active'
    AND u.auth_user_id IS NOT NULL;
$$;

-- =====================================================
-- TRIGGER: NOTIFICAÇÕES DE VENDAS
-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_notify_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name TEXT;
  v_admin_id UUID;
BEGIN
  -- Apenas notificar quando venda é criada (INSERT)
  IF TG_OP = 'INSERT' AND NEW.status = 'closed' THEN
    -- Buscar nome do cliente
    SELECT contact_name INTO v_client_name
    FROM public.clients
    WHERE id = NEW.client_id;
    
    -- Notificar vendedor
    PERFORM public.create_notification(
      NEW.seller_auth_id,
      'success',
      'Nova Venda Registrada',
      format('Venda para %s no valor de R$ %s registrada com sucesso!', 
        COALESCE(v_client_name, 'Cliente'), 
        to_char(NEW.gross_value, 'FM999G999G999D00')
      )
    );
    
    -- Notificar todos os admins
    FOR v_admin_id IN SELECT auth_user_id FROM public.get_admin_user_ids() LOOP
      PERFORM public.create_notification(
        v_admin_id,
        'info',
        'Nova Venda',
        format('Venda de R$ %s registrada para %s', 
          to_char(NEW.gross_value, 'FM999G999G999D00'),
          COALESCE(v_client_name, 'Cliente')
        )
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_sale ON public.sales;
CREATE TRIGGER trg_notify_sale
  AFTER INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_sale();

-- =====================================================
-- TRIGGER: NOTIFICAÇÕES DE OPORTUNIDADES
-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_notify_opportunity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name TEXT;
  v_admin_id UUID;
  v_stage_label TEXT;
BEGIN
  -- Buscar nome do cliente
  SELECT contact_name INTO v_client_name
  FROM public.clients
  WHERE id = COALESCE(NEW.client_id, OLD.client_id);
  
  -- INSERT: Nova oportunidade
  IF TG_OP = 'INSERT' THEN
    -- Notificar vendedor
    PERFORM public.create_notification(
      NEW.seller_auth_id,
      'info',
      'Nova Oportunidade Criada',
      format('Oportunidade para %s no valor de R$ %s criada', 
        COALESCE(v_client_name, 'Cliente'),
        COALESCE(to_char(NEW.gross_value, 'FM999G999G999D00'), '0,00')
      )
    );
    
    -- Notificar admins
    FOR v_admin_id IN SELECT auth_user_id FROM public.get_admin_user_ids() LOOP
      PERFORM public.create_notification(
        v_admin_id,
        'info',
        'Nova Oportunidade',
        format('Oportunidade de R$ %s para %s', 
          COALESCE(to_char(NEW.gross_value, 'FM999G999G999D00'), '0,00'),
          COALESCE(v_client_name, 'Cliente')
        )
      );
    END LOOP;
  END IF;
  
  -- UPDATE: Mudança de estágio
  IF TG_OP = 'UPDATE' AND OLD.stage != NEW.stage THEN
    -- Mapear estágios para labels
    v_stage_label := CASE NEW.stage
      WHEN 'qualification' THEN 'Qualificação'
      WHEN 'proposal' THEN 'Proposta'
      WHEN 'negotiation' THEN 'Negociação'
      WHEN 'won' THEN 'Ganha'
      WHEN 'lost' THEN 'Perdida'
      ELSE NEW.stage
    END;
    
    -- Notificar vendedor
    IF NEW.stage = 'won' THEN
      PERFORM public.create_notification(
        NEW.seller_auth_id,
        'success',
        'Oportunidade Ganha! 🎉',
        format('Parabéns! Oportunidade de %s foi convertida em venda!', 
          COALESCE(v_client_name, 'Cliente')
        )
      );
    ELSIF NEW.stage = 'lost' THEN
      PERFORM public.create_notification(
        NEW.seller_auth_id,
        'warning',
        'Oportunidade Perdida',
        format('Oportunidade de %s foi perdida. Motivo: %s', 
          COALESCE(v_client_name, 'Cliente'),
          COALESCE(NEW.loss_reason, 'Não informado')
        )
      );
    ELSE
      PERFORM public.create_notification(
        NEW.seller_auth_id,
        'success',
        'Oportunidade Avançou',
        format('Oportunidade de %s avançou para: %s', 
          COALESCE(v_client_name, 'Cliente'),
          v_stage_label
        )
      );
    END IF;
    
    -- Notificar admins
    FOR v_admin_id IN SELECT auth_user_id FROM public.get_admin_user_ids() LOOP
      PERFORM public.create_notification(
        v_admin_id,
        CASE WHEN NEW.stage = 'won' THEN 'success' 
             WHEN NEW.stage = 'lost' THEN 'warning' 
             ELSE 'info' END,
        format('Oportunidade: %s', v_stage_label),
        format('Oportunidade de %s agora está em: %s', 
          COALESCE(v_client_name, 'Cliente'),
          v_stage_label
        )
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_opportunity ON public.opportunities;
CREATE TRIGGER trg_notify_opportunity
  AFTER INSERT OR UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_opportunity();

-- =====================================================
-- TRIGGER: NOTIFICAÇÕES DE DEMONSTRAÇÕES
-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_notify_demonstration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name TEXT;
  v_seller_id UUID;
  v_admin_id UUID;
  v_assigned_user_id UUID;
  v_status_label TEXT;
BEGIN
  -- Buscar informações do cliente e vendedor
  SELECT c.contact_name, c.seller_auth_id
  INTO v_client_name, v_seller_id
  FROM public.clients c
  WHERE c.id = COALESCE(NEW.client_id, OLD.client_id);
  
  -- INSERT: Nova demonstração agendada
  IF TG_OP = 'INSERT' THEN
    -- Notificar vendedor
    IF v_seller_id IS NOT NULL THEN
      PERFORM public.create_notification(
        v_seller_id,
        'info',
        'Nova Demonstração Agendada',
        format('Demonstração para %s agendada para %s', 
          COALESCE(v_client_name, 'Cliente'),
          to_char(NEW.date, 'DD/MM/YYYY HH24:MI')
        )
      );
    END IF;
    
    -- Notificar usuários atribuídos
    IF NEW.assigned_users IS NOT NULL THEN
      FOREACH v_assigned_user_id IN ARRAY NEW.assigned_users LOOP
        PERFORM public.create_notification(
          v_assigned_user_id,
          'info',
          'Você foi Designado a uma Demonstração',
          format('Demonstração para %s em %s', 
            COALESCE(v_client_name, 'Cliente'),
            to_char(NEW.date, 'DD/MM/YYYY HH24:MI')
          )
        );
      END LOOP;
    END IF;
    
    -- Notificar admins
    FOR v_admin_id IN SELECT auth_user_id FROM public.get_admin_user_ids() LOOP
      PERFORM public.create_notification(
        v_admin_id,
        'info',
        'Nova Demonstração',
        format('Demonstração para %s agendada', COALESCE(v_client_name, 'Cliente'))
      );
    END LOOP;
  END IF;
  
  -- UPDATE: Mudança de status
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    v_status_label := CASE NEW.status
      WHEN 'scheduled' THEN 'Agendada'
      WHEN 'completed' THEN 'Concluída'
      WHEN 'cancelled' THEN 'Cancelada'
      ELSE NEW.status
    END;
    
    -- Notificar vendedor
    IF v_seller_id IS NOT NULL THEN
      PERFORM public.create_notification(
        v_seller_id,
        CASE WHEN NEW.status = 'completed' THEN 'success' 
             WHEN NEW.status = 'cancelled' THEN 'warning'
             ELSE 'info' END,
        format('Demonstração: %s', v_status_label),
        format('Demonstração de %s foi %s', 
          COALESCE(v_client_name, 'Cliente'),
          LOWER(v_status_label)
        )
      );
    END IF;
    
    -- Notificar usuários atribuídos
    IF NEW.assigned_users IS NOT NULL THEN
      FOREACH v_assigned_user_id IN ARRAY NEW.assigned_users LOOP
        PERFORM public.create_notification(
          v_assigned_user_id,
          CASE WHEN NEW.status = 'completed' THEN 'success' 
               WHEN NEW.status = 'cancelled' THEN 'warning'
               ELSE 'info' END,
          format('Demonstração: %s', v_status_label),
          format('Demonstração de %s', COALESCE(v_client_name, 'Cliente'))
        );
      END LOOP;
    END IF;
    
    -- Notificar admins se concluída
    IF NEW.status = 'completed' THEN
      FOR v_admin_id IN SELECT auth_user_id FROM public.get_admin_user_ids() LOOP
        PERFORM public.create_notification(
          v_admin_id,
          'success',
          'Demonstração Concluída',
          format('Demonstração de %s finalizada', COALESCE(v_client_name, 'Cliente'))
        );
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_demonstration ON public.demonstrations;
CREATE TRIGGER trg_notify_demonstration
  AFTER INSERT OR UPDATE ON public.demonstrations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_demonstration();

-- =====================================================
-- TRIGGER: NOTIFICAÇÕES DE SERVIÇOS
-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_notify_service()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_name TEXT;
  v_seller_id UUID;
  v_admin_id UUID;
  v_assigned_user_id UUID;
  v_status_label TEXT;
  v_service_label TEXT;
BEGIN
  -- Buscar informações do cliente e vendedor
  SELECT c.contact_name, c.seller_auth_id
  INTO v_client_name, v_seller_id
  FROM public.clients c
  WHERE c.id = COALESCE(NEW.client_id, OLD.client_id);
  
  -- Label do tipo de serviço
  v_service_label := CASE COALESCE(NEW.service_type, OLD.service_type)
    WHEN 'maintenance' THEN 'Manutenção'
    WHEN 'revision' THEN 'Revisão'
    WHEN 'spraying' THEN 'Pulverização'
    ELSE 'Serviço'
  END;
  
  -- INSERT: Novo serviço agendado
  IF TG_OP = 'INSERT' THEN
    -- Notificar vendedor
    IF v_seller_id IS NOT NULL THEN
      PERFORM public.create_notification(
        v_seller_id,
        'info',
        format('Novo %s Agendado', v_service_label),
        format('%s para %s agendado para %s', 
          v_service_label,
          COALESCE(v_client_name, 'Cliente'),
          to_char(NEW.date, 'DD/MM/YYYY')
        )
      );
    END IF;
    
    -- Notificar usuários atribuídos
    IF NEW.assigned_users IS NOT NULL THEN
      FOREACH v_assigned_user_id IN ARRAY NEW.assigned_users LOOP
        PERFORM public.create_notification(
          v_assigned_user_id,
          'info',
          format('Você foi Designado a um %s', v_service_label),
          format('%s para %s em %s', 
            v_service_label,
            COALESCE(v_client_name, 'Cliente'),
            to_char(NEW.date, 'DD/MM/YYYY')
          )
        );
      END LOOP;
    END IF;
    
    -- Notificar admins
    FOR v_admin_id IN SELECT auth_user_id FROM public.get_admin_user_ids() LOOP
      PERFORM public.create_notification(
        v_admin_id,
        'info',
        format('Novo %s', v_service_label),
        format('%s para %s agendado', v_service_label, COALESCE(v_client_name, 'Cliente'))
      );
    END LOOP;
  END IF;
  
  -- UPDATE: Mudança de status
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    v_status_label := CASE NEW.status
      WHEN 'scheduled' THEN 'Agendado'
      WHEN 'completed' THEN 'Concluído'
      WHEN 'cancelled' THEN 'Cancelado'
      ELSE NEW.status
    END;
    
    -- Notificar vendedor
    IF v_seller_id IS NOT NULL THEN
      PERFORM public.create_notification(
        v_seller_id,
        CASE WHEN NEW.status = 'completed' THEN 'success' 
             WHEN NEW.status = 'cancelled' THEN 'warning'
             ELSE 'info' END,
        format('%s: %s', v_service_label, v_status_label),
        format('%s de %s foi %s', 
          v_service_label,
          COALESCE(v_client_name, 'Cliente'),
          LOWER(v_status_label)
        )
      );
    END IF;
    
    -- Notificar usuários atribuídos
    IF NEW.assigned_users IS NOT NULL THEN
      FOREACH v_assigned_user_id IN ARRAY NEW.assigned_users LOOP
        PERFORM public.create_notification(
          v_assigned_user_id,
          CASE WHEN NEW.status = 'completed' THEN 'success' 
               WHEN NEW.status = 'cancelled' THEN 'warning'
               ELSE 'info' END,
          format('%s: %s', v_service_label, v_status_label),
          format('%s de %s', v_service_label, COALESCE(v_client_name, 'Cliente'))
        );
      END LOOP;
    END IF;
    
    -- Notificar admins se concluído
    IF NEW.status = 'completed' THEN
      FOR v_admin_id IN SELECT auth_user_id FROM public.get_admin_user_ids() LOOP
        PERFORM public.create_notification(
          v_admin_id,
          'success',
          format('%s Concluído', v_service_label),
          format('%s de %s finalizado', v_service_label, COALESCE(v_client_name, 'Cliente'))
        );
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_service ON public.services;
CREATE TRIGGER trg_notify_service
  AFTER INSERT OR UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_service();

-- =====================================================
-- TRIGGER: NOTIFICAÇÕES DE COMISSÕES
-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_notify_commission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- INSERT: Nova comissão criada
  IF TG_OP = 'INSERT' THEN
    PERFORM public.create_notification(
      NEW.seller_auth_id,
      'success',
      'Nova Comissão Gerada! 💰',
      format('Comissão de R$ %s gerada com sucesso!', 
        to_char(NEW.amount, 'FM999G999G999D00')
      )
    );
  END IF;
  
  -- UPDATE: Mudança de status de pagamento
  IF TG_OP = 'UPDATE' AND OLD.pay_status != NEW.pay_status THEN
    IF NEW.pay_status = 'paid' THEN
      PERFORM public.create_notification(
        NEW.seller_auth_id,
        'success',
        'Comissão Paga! 🎉',
        format('Sua comissão de R$ %s foi paga!', 
          to_char(NEW.amount, 'FM999G999G999D00')
        )
      );
    ELSIF NEW.pay_status = 'cancelled' THEN
      PERFORM public.create_notification(
        NEW.seller_auth_id,
        'warning',
        'Comissão Cancelada',
        format('Comissão de R$ %s foi cancelada. %s', 
          to_char(NEW.amount, 'FM999G999G999D00'),
          COALESCE('Motivo: ' || NEW.notes, '')
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_commission ON public.commissions;
CREATE TRIGGER trg_notify_commission
  AFTER INSERT OR UPDATE ON public.commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_commission();

-- =====================================================
-- TRIGGER: NOTIFICAÇÕES DE ESTOQUE DE PRODUTOS
-- =====================================================
CREATE OR REPLACE FUNCTION public.trg_notify_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Apenas notificar em UPDATE quando o estoque muda
  IF TG_OP = 'UPDATE' AND OLD.stock != NEW.stock THEN
    -- Estoque zerado - alerta crítico
    IF NEW.stock = 0 AND OLD.stock > 0 THEN
      FOR v_admin_id IN SELECT auth_user_id FROM public.get_admin_user_ids() LOOP
        PERFORM public.create_notification(
          v_admin_id,
          'alert',
          'Produto Sem Estoque! ⚠️',
          format('Produto "%s" está sem estoque!', NEW.name)
        );
      END LOOP;
    -- Estoque baixo - aviso
    ELSIF NEW.stock <= NEW.low_stock_threshold AND NEW.stock > 0 
          AND (OLD.stock > NEW.low_stock_threshold OR OLD.stock = 0) THEN
      FOR v_admin_id IN SELECT auth_user_id FROM public.get_admin_user_ids() LOOP
        PERFORM public.create_notification(
          v_admin_id,
          'warning',
          'Estoque Baixo',
          format('Produto "%s" está com estoque baixo: %s unidades', 
            NEW.name, 
            NEW.stock
          )
        );
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_product_stock ON public.products;
CREATE TRIGGER trg_notify_product_stock
  AFTER UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_notify_product_stock();