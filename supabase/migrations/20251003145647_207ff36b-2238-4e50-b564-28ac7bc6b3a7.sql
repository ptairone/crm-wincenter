-- =====================================================
-- CONFIGURAÇÃO DE CRON JOBS PARA NOTIFICAÇÕES
-- =====================================================

-- Habilitar extensão pg_cron se ainda não estiver habilitada
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Habilitar extensão pg_net se ainda não estiver habilitada
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Limpar cron jobs antigos se existirem
SELECT cron.unschedule('check-visits-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-visits-daily'
);

SELECT cron.unschedule('check-stock-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-stock-daily'
);

-- =====================================================
-- CRON JOB: Verificar visitas pendentes (diário às 9h)
-- =====================================================
SELECT cron.schedule(
  'check-visits-daily',
  '0 9 * * *', -- Todos os dias às 9h
  $$
  SELECT net.http_post(
    url:='https://ouozlpdfkkwcmyayitgm.supabase.co/functions/v1/check-visits',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91b3pscGRma2t3Y215YXlpdGdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNjY3ODAsImV4cCI6MjA3NDc0Mjc4MH0._1ApMLqVI72711likl66kPulkOcTGwtt80C-XPKXtLg"}'::jsonb,
    body:='{"scheduled": true}'::jsonb
  ) as request_id;
  $$
);

-- =====================================================
-- CRON JOB: Verificar estoque de produtos (diário às 8h)
-- =====================================================
SELECT cron.schedule(
  'check-stock-daily',
  '0 8 * * *', -- Todos os dias às 8h
  $$
  SELECT net.http_post(
    url:='https://ouozlpdfkkwcmyayitgm.supabase.co/functions/v1/check-stock',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91b3pscGRma2t3Y215YXlpdGdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNjY3ODAsImV4cCI6MjA3NDc0Mjc4MH0._1ApMLqVI72711likl66kPulkOcTGwtt80C-XPKXtLg"}'::jsonb,
    body:='{"scheduled": true}'::jsonb
  ) as request_id;
  $$
);