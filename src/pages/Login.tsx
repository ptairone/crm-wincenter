import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { loginSchema } from '@/lib/validation';
import { useSiteSettings } from '@/hooks/useSiteSettings';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { settings } = useSiteSettings();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input with zod
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      const firstError = validation.error.errors[0];
      toast.error(firstError.message);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: validation.data.email,
        password: validation.data.password,
      });

      if (error) throw error;

      if (data.user) {
        // Fetch user role to redirect appropriately
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role, status')
          .eq('auth_user_id', data.user.id)
          .single();

        if (userError) throw userError;

        // Verificar se o cadastro está pendente de aprovação
        if (userData?.status === 'pending') {
          await supabase.auth.signOut();
          toast.error('Seu cadastro ainda está aguardando aprovação do administrador. Por favor, aguarde.');
          return;
        }

        if (userData?.status !== 'active') {
          await supabase.auth.signOut();
          toast.error('Sua conta está inativa. Entre em contato com o administrador.');
          return;
        }

        toast.success('Login realizado com sucesso!');
        
        if (userData?.role === 'admin') {
          navigate('/admin/reports');
        } else {
          navigate('/seller/dashboard');
        }
      }
    } catch (error: any) {
      // Don't log sensitive authentication errors to console
      toast.error('Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${settings?.login_banner_url || 'https://ouozlpdfkkwcmyayitgm.supabase.co/storage/v1/object/public/brand/580.webp'})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 z-0 bg-black/40" />
      
      <Card className="w-full max-w-md relative z-10 backdrop-blur-sm bg-white/25 border-white/30 shadow-2xl">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto">
            <img 
              src={settings?.logo_url || '/logo.png'} 
              alt="WinCenter" 
              className="h-24 w-auto object-contain mx-auto"
            />
          </div>
          <div>
            <CardDescription className="text-white">Entre com suas credenciais para acessar o CRM</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                className="bg-white/90 text-black placeholder:text-gray-500"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                className="bg-white/90 text-black placeholder:text-gray-500"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
            <div className="text-center">
              <Link to="/register" className="text-white text-sm hover:underline">
                Não tem uma conta? Cadastre-se
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
