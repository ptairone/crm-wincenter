import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Upload, Settings as SettingsIcon } from 'lucide-react';

interface SiteSettings {
  id: string;
  logo_url: string | null;
  login_banner_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
}

export default function SiteSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (error: any) {
      toast.error('Erro ao carregar configurações');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file: File, path: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${path}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError, data } = await supabase.storage
      .from('brand')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('brand')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      let logoUrl = settings.logo_url;
      let bannerUrl = settings.login_banner_url;

      // Upload logo if changed
      if (logoFile) {
        logoUrl = await uploadImage(logoFile, 'logo');
      }

      // Upload banner if changed
      if (bannerFile) {
        bannerUrl = await uploadImage(bannerFile, 'banner');
      }

      const { error } = await supabase
        .from('site_settings')
        .update({
          logo_url: logoUrl,
          login_banner_url: bannerUrl,
          primary_color: settings.primary_color,
          secondary_color: settings.secondary_color,
          accent_color: settings.accent_color,
        })
        .eq('id', settings.id);

      if (error) throw error;

      toast.success('Configurações salvas com sucesso!');
      setLogoFile(null);
      setBannerFile(null);
      fetchSettings();
    } catch (error: any) {
      toast.error('Erro ao salvar configurações');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Nenhuma configuração encontrada</p>
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-4xl py-6 space-y-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Configurações do Site</h1>
            <p className="text-muted-foreground">Personalize a aparência do sistema</p>
          </div>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>Identidade Visual</CardTitle>
          <CardDescription>Gerencie logo e imagens do site</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="logo">Logo</Label>
            <div className="flex items-center gap-4">
              {settings.logo_url && !logoFile && (
                <img 
                  src={settings.logo_url} 
                  alt="Logo atual" 
                  className="h-16 w-16 object-contain border rounded p-2"
                />
              )}
              {logoFile && (
                <img 
                  src={URL.createObjectURL(logoFile)} 
                  alt="Nova logo" 
                  className="h-16 w-16 object-contain border rounded p-2"
                />
              )}
              <div className="flex-1">
                <Input
                  id="logo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Recomendado: PNG ou SVG com fundo transparente
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="banner">Banner de Login</Label>
            <div className="flex flex-col gap-4">
              {settings.login_banner_url && !bannerFile && (
                <img 
                  src={settings.login_banner_url} 
                  alt="Banner atual" 
                  className="w-full h-40 object-cover rounded border"
                />
              )}
              {bannerFile && (
                <img 
                  src={URL.createObjectURL(bannerFile)} 
                  alt="Novo banner" 
                  className="w-full h-40 object-cover rounded border"
                />
              )}
              <div>
                <Input
                  id="banner"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Recomendado: Imagem horizontal de alta qualidade
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cores do Sistema</CardTitle>
          <CardDescription>Personalize a paleta de cores</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primary">Cor Primária</Label>
              <div className="flex gap-2">
                <Input
                  id="primary"
                  type="color"
                  value={settings.primary_color || '#0066CC'}
                  onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={settings.primary_color || '#0066CC'}
                  onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary">Cor Secundária</Label>
              <div className="flex gap-2">
                <Input
                  id="secondary"
                  type="color"
                  value={settings.secondary_color || '#FF6B35'}
                  onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={settings.secondary_color || '#FF6B35'}
                  onChange={(e) => setSettings({ ...settings, secondary_color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accent">Cor de Destaque</Label>
              <div className="flex gap-2">
                <Input
                  id="accent"
                  type="color"
                  value={settings.accent_color || '#4ECDC4'}
                  onChange={(e) => setSettings({ ...settings, accent_color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={settings.accent_color || '#4ECDC4'}
                  onChange={(e) => setSettings({ ...settings, accent_color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={fetchSettings}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Salvar Configurações
            </>
          )}
        </Button>
      </div>
      </div>
    </AppLayout>
  );
}
