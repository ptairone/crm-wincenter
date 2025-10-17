-- Adicionar colunas de rastreamento de envio WhatsApp
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS whatsapp_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMPTZ;