-- Criar função para criar usuário automaticamente após registro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (auth_user_id, email, name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'seller', -- Role padrão
    'pending' -- Status pendente aguardando aprovação
  );
  RETURN NEW;
END;
$$;

-- Criar trigger para executar a função quando um novo usuário se registrar
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Adicionar valor 'pending' ao enum user_status se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending' AND enumtypid = 'user_status'::regtype) THEN
    ALTER TYPE user_status ADD VALUE 'pending';
  END IF;
END $$;