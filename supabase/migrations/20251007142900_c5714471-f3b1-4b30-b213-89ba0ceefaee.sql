-- Atualizar os dados existentes para usar os novos valores
UPDATE demonstrations SET status = 'completed'::demo_status WHERE status = 'done'::demo_status;
UPDATE demonstrations SET status = 'cancelled'::demo_status WHERE status = 'canceled'::demo_status;