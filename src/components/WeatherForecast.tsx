import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Cloud, Droplets, Wind, Thermometer, Search, CloudRain, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  willRain: boolean;
  description: string;
  cityName: string;
}

const WEATHER_API_KEY = '2266f269be41b5b6234971e5e0a7e46d';

interface WeatherForecastProps {
  selectedDate?: string;
  onWeatherChange?: (weather: WeatherData | null) => void;
  showCard?: boolean;
}

export function WeatherForecast({ selectedDate, onWeatherChange, showCard = true }: WeatherForecastProps) {
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (onWeatherChange) {
      onWeatherChange(weather);
    }
  }, [weather, onWeatherChange]);

  const fetchWeather = async () => {
    if (!city.trim()) {
      toast.error('Digite o nome da cidade');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${WEATHER_API_KEY}&units=metric&lang=pt_br`
      );

      if (!response.ok) {
        throw new Error('Cidade não encontrada');
      }

      const data = await response.json();

      const weatherData: WeatherData = {
        temperature: Math.round(data.main.temp),
        humidity: data.main.humidity,
        windSpeed: Math.round(data.wind.speed * 3.6), // Convert m/s to km/h
        willRain: data.weather[0].main.toLowerCase().includes('rain'),
        description: data.weather[0].description,
        cityName: data.name,
      };

      setWeather(weatherData);
      toast.success('Previsão do tempo carregada!');
    } catch (error) {
      console.error('Error fetching weather:', error);
      toast.error('Erro ao buscar previsão do tempo. Verifique o nome da cidade.');
      setWeather(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      fetchWeather();
    }
  };

  const content = (
    <div className="space-y-4">
      {selectedDate && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground pb-2 border-b">
          <Calendar className="h-4 w-4" />
          <span>
            {format(new Date(selectedDate), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>
      )}
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              placeholder="Digite o nome da cidade"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onKeyPress={handleKeyPress}
            />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={fetchWeather} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              Buscar
            </Button>
          </div>
        </div>

        {weather && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
            <div className="flex flex-col items-center p-3 bg-muted rounded-lg">
              <Thermometer className="h-6 w-6 mb-2 text-primary" />
              <span className="text-2xl font-bold">{weather.temperature}°C</span>
              <span className="text-xs text-muted-foreground">Temperatura</span>
            </div>

            <div className="flex flex-col items-center p-3 bg-muted rounded-lg">
              <Droplets className="h-6 w-6 mb-2 text-primary" />
              <span className="text-2xl font-bold">{weather.humidity}%</span>
              <span className="text-xs text-muted-foreground">Umidade</span>
            </div>

            <div className="flex flex-col items-center p-3 bg-muted rounded-lg">
              <Wind className="h-6 w-6 mb-2 text-primary" />
              <span className="text-2xl font-bold">{weather.windSpeed}</span>
              <span className="text-xs text-muted-foreground">km/h</span>
            </div>

            <div className="flex flex-col items-center p-3 bg-muted rounded-lg">
              <CloudRain className="h-6 w-6 mb-2 text-primary" />
              <span className="text-2xl font-bold">{weather.willRain ? 'Sim' : 'Não'}</span>
              <span className="text-xs text-muted-foreground">Vai chover</span>
            </div>

            <div className="col-span-2 md:col-span-4 text-center p-2 bg-primary/10 rounded-lg">
              <p className="font-semibold">{weather.cityName}</p>
              <p className="text-sm text-muted-foreground capitalize">{weather.description}</p>
            </div>
          </div>
        )}
    </div>
  );

  if (!showCard) {
    return content;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5" />
          Previsão do Tempo
        </CardTitle>
      </CardHeader>
      <CardContent>
        {content}
      </CardContent>
    </Card>
  );
}
