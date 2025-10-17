import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { hexToHSL } from '@/lib/utils';

interface SiteSettings {
  logo_url: string | null;
  login_banner_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      const root = document.documentElement;
      
      // Aplicar cor primária
      if (settings.primary_color) {
        const primaryHSL = hexToHSL(settings.primary_color);
        root.style.setProperty('--primary', primaryHSL);
        root.style.setProperty('--sidebar-primary', primaryHSL);
        root.style.setProperty('--ring', primaryHSL);
        root.style.setProperty('--chart-1', primaryHSL);
        root.style.setProperty('--success', primaryHSL);
      }
      
      // Aplicar cor secundária
      if (settings.secondary_color) {
        const secondaryHSL = hexToHSL(settings.secondary_color);
        root.style.setProperty('--secondary', secondaryHSL);
        root.style.setProperty('--sidebar-accent', secondaryHSL);
      }
      
      // Aplicar cor de destaque
      if (settings.accent_color) {
        const accentHSL = hexToHSL(settings.accent_color);
        root.style.setProperty('--accent', accentHSL);
        root.style.setProperty('--warning', accentHSL);
        root.style.setProperty('--chart-2', accentHSL);
      }
    }
  }, [settings]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('logo_url, login_banner_url, primary_color, secondary_color, accent_color')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setSettings(data);
      }
    } catch (error) {
      console.error('Error fetching site settings:', error);
    } finally {
      setLoading(false);
    }
  };

  return { settings, loading };
}
