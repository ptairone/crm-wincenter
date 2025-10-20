-- Ajustar format_currency para padrão brasileiro (R$ 1.234,56)
CREATE OR REPLACE FUNCTION format_currency(amount NUMERIC)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- Troca separadores padrão en-US (3,520.00) para pt-BR (3.520,00)
  RETURN translate(to_char(amount, 'FM999G999G999D00'), '.,', ',.');
END;
$$;