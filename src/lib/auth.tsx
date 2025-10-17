import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  userRole: 'admin' | 'seller' | 'technician' | null;
  userName: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  userRole: null,
  userName: null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'seller' | 'technician' | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener FIRST to avoid missing events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Defer any Supabase calls to avoid deadlocks
        setTimeout(() => {
          fetchUserRole(session.user!.id);
        }, 0);
      } else {
        setUserRole(null);
        setLoading(false);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setTimeout(() => {
          fetchUserRole(session.user!.id);
        }, 0);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (userId: string) => {
    try {
      console.log('[Auth] Buscando role do usuário:', userId);
      const { data, error } = await supabase
        .from('users')
        .select('role, name')
        .eq('auth_user_id', userId)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error('[Auth] Erro ao buscar role:', error);
        throw error;
      }

      if (!data) {
        console.warn('[Auth] Usuário sem registro ativo na tabela users. Fazendo logout.');
        await supabase.auth.signOut();
        setUserRole(null);
        setUser(null);
        setSession(null);
        return;
      }
      
      console.log('[Auth] Role encontrado:', data.role);
      setUserRole((data as any).role || null);
      setUserName((data as any).name || null);
    } catch (error) {
      console.error('[Auth] Usuário não encontrado ou inativo, fazendo logout');
      // User doesn't exist or is inactive - sign them out
      await supabase.auth.signOut();
      setUserRole(null);
      setUser(null);
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, userRole, userName, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
