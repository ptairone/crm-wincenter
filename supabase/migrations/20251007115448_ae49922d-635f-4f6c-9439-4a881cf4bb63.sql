-- Atualizar política para permitir leitura anônima das configurações do site
DROP POLICY IF EXISTS "site_settings_select_all" ON public.site_settings;

CREATE POLICY "site_settings_select_public"
ON public.site_settings
FOR SELECT
TO anon, authenticated
USING (true);