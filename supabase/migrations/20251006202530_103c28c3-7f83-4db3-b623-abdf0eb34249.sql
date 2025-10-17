-- Criar tabela de configurações do site
CREATE TABLE public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url TEXT,
  login_banner_url TEXT,
  primary_color TEXT DEFAULT '#0066CC',
  secondary_color TEXT DEFAULT '#FF6B35',
  accent_color TEXT DEFAULT '#4ECDC4',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Inserir configurações padrão
INSERT INTO public.site_settings (logo_url, login_banner_url, primary_color, secondary_color, accent_color)
VALUES (
  '/logo.png',
  'https://ouozlpdfkkwcmyayitgm.supabase.co/storage/v1/object/public/brand/580.webp',
  '#0066CC',
  '#FF6B35',
  '#4ECDC4'
);

-- Habilitar RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: qualquer um pode ler, apenas admin pode editar
CREATE POLICY "site_settings_select_all"
ON public.site_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "site_settings_update_admin"
ON public.site_settings
FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();