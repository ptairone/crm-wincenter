-- Adicionar campos de previsão do tempo na tabela demonstrations
ALTER TABLE public.demonstrations
ADD COLUMN weather_city TEXT,
ADD COLUMN weather_temperature NUMERIC,
ADD COLUMN weather_humidity NUMERIC,
ADD COLUMN weather_wind_speed NUMERIC,
ADD COLUMN weather_will_rain BOOLEAN,
ADD COLUMN weather_description TEXT,
ADD COLUMN weather_fetched_at TIMESTAMP WITH TIME ZONE;