import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Target, Users, TrendingUp } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface Goal {
  id: string;
  level: string;
  sales_goal: number;
  visits_goal: number;
  proposals_goal: number;
  period_ym: string;
  seller_auth_id?: string;
  seller_name?: string;
  seller_email?: string;
}

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sellers, setSellers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    level: 'team',
    seller_auth_id: '',
    period_ym: new Date().toISOString().slice(0, 7),
    sales_goal: '',
    visits_goal: '',
    proposals_goal: '',
  });

  useEffect(() => {
    fetchGoals();
    fetchSellers();
  }, []);

  const fetchSellers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('auth_user_id, name, email')
        .eq('role', 'seller')
        .eq('status', 'active');

      if (error) throw error;
      setSellers(data || []);
    } catch (error) {
      console.error('Error fetching sellers:', error);
    }
  };

  const fetchGoals = async () => {
    try {
      const { data: goalsData, error } = await supabase
        .from('goals')
        .select('*')
        .order('period_ym', { ascending: false });

      if (error) throw error;

      // Fetch user data for seller goals
      const sellerGoals = goalsData?.filter(g => g.level === 'seller' && g.seller_auth_id) || [];
      const sellerIds = [...new Set(sellerGoals.map(g => g.seller_auth_id))];

      if (sellerIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('auth_user_id, name, email')
          .in('auth_user_id', sellerIds);

        // Map user data to goals
        const goalsWithUsers = goalsData?.map(goal => {
          if (goal.level === 'seller' && goal.seller_auth_id) {
            const user = usersData?.find(u => u.auth_user_id === goal.seller_auth_id);
            return {
              ...goal,
              seller_name: user?.name,
              seller_email: user?.email,
            };
          }
          return goal;
        });

        setGoals(goalsWithUsers || []);
      } else {
        setGoals(goalsData || []);
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLevelInfo = (level: string) => {
    const levels: Record<string, { label: string; color: string; icon: any }> = {
      team: { label: 'Equipe', color: 'bg-blue-100 text-blue-800', icon: Users },
      seller: { label: 'Vendedor', color: 'bg-green-100 text-green-800', icon: Target },
    };
    return levels[level] || { label: level, color: 'bg-gray-100 text-gray-800', icon: Target };
  };

  const formatPeriod = (periodYm: string) => {
    const [year, month] = periodYm.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const goalData: any = {
        level: formData.level,
        period_ym: formData.period_ym,
        sales_goal: formData.sales_goal ? Number(formData.sales_goal) : null,
        visits_goal: formData.visits_goal ? Number(formData.visits_goal) : null,
        proposals_goal: formData.proposals_goal ? Number(formData.proposals_goal) : null,
      };

      if (formData.level === 'seller' && formData.seller_auth_id) {
        goalData.seller_auth_id = formData.seller_auth_id;
      }

      const { error } = await supabase
        .from('goals')
        .insert([goalData]);

      if (error) throw error;

      toast.success('Meta criada com sucesso!');
      setDialogOpen(false);
      setFormData({
        level: 'team',
        seller_auth_id: '',
        period_ym: new Date().toISOString().slice(0, 7),
        sales_goal: '',
        visits_goal: '',
        proposals_goal: '',
      });
      fetchGoals();
    } catch (error: any) {
      console.error('Error creating goal:', error);
      toast.error('Erro ao criar meta: ' + error.message);
    }
  };

  const teamGoals = goals.filter(g => g.level === 'team');
  const sellerGoals = goals.filter(g => g.level === 'seller');

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Metas</h1>
            <p className="text-muted-foreground">Defina e acompanhe metas de desempenho</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Meta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Meta</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="level">Nível *</Label>
                  <Select
                    value={formData.level}
                    onValueChange={(value) => setFormData({ ...formData, level: value, seller_auth_id: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team">Equipe</SelectItem>
                      <SelectItem value="seller">Vendedor Individual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.level === 'seller' && (
                  <div className="space-y-2">
                    <Label htmlFor="seller_auth_id">Vendedor *</Label>
                    <Select
                      value={formData.seller_auth_id}
                      onValueChange={(value) => setFormData({ ...formData, seller_auth_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um vendedor" />
                      </SelectTrigger>
                      <SelectContent>
                        {sellers.map((seller) => (
                          <SelectItem key={seller.auth_user_id} value={seller.auth_user_id}>
                            {seller.name} - {seller.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="period_ym">Período (Mês/Ano) *</Label>
                  <Input
                    id="period_ym"
                    type="month"
                    value={formData.period_ym}
                    onChange={(e) => setFormData({ ...formData, period_ym: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sales_goal">Meta de Vendas (R$)</Label>
                  <Input
                    id="sales_goal"
                    type="number"
                    step="0.01"
                    value={formData.sales_goal}
                    onChange={(e) => setFormData({ ...formData, sales_goal: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="visits_goal">Meta de Visitas</Label>
                    <Input
                      id="visits_goal"
                      type="number"
                      value={formData.visits_goal}
                      onChange={(e) => setFormData({ ...formData, visits_goal: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="proposals_goal">Meta de Propostas</Label>
                    <Input
                      id="proposals_goal"
                      type="number"
                      value={formData.proposals_goal}
                      onChange={(e) => setFormData({ ...formData, proposals_goal: e.target.value })}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  Criar Meta
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Total de Metas</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{goals.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {teamGoals.length} da equipe • {sellerGoals.length} individuais
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Meta de Vendas Total</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  notation: 'compact',
                }).format(teamGoals[0]?.sales_goal || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Meta da equipe atual
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">Meta de Visitas</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {teamGoals[0]?.visits_goal || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Visitas mensais da equipe
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="team" className="space-y-4">
          <TabsList>
            <TabsTrigger value="team">
              <Users className="h-4 w-4 mr-2" />
              Metas da Equipe
            </TabsTrigger>
            <TabsTrigger value="seller">
              <Target className="h-4 w-4 mr-2" />
              Metas por Vendedor
            </TabsTrigger>
          </TabsList>

          <TabsContent value="team" className="space-y-4">
            {teamGoals.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <p className="text-center text-muted-foreground">
                    Nenhuma meta de equipe definida
                  </p>
                </CardContent>
              </Card>
            ) : (
              teamGoals.map((goal) => {
                const levelInfo = getLevelInfo(goal.level);
                const LevelIcon = levelInfo.icon;

                return (
                  <Card key={goal.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <LevelIcon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle>{formatPeriod(goal.period_ym)}</CardTitle>
                            <CardDescription>
                              <Badge className={levelInfo.color}>{levelInfo.label}</Badge>
                            </CardDescription>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-muted-foreground">Meta de Vendas</span>
                          <span className="text-2xl font-bold">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(goal.sales_goal || 0)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-muted-foreground">Meta de Visitas</span>
                          <span className="text-2xl font-bold">{goal.visits_goal || 0}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-muted-foreground">Meta de Propostas</span>
                          <span className="text-2xl font-bold">{goal.proposals_goal || 0}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="seller" className="space-y-4">
            {sellerGoals.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <p className="text-center text-muted-foreground">
                    Nenhuma meta individual definida
                  </p>
                </CardContent>
              </Card>
            ) : (
              sellerGoals.map((goal) => {
                const levelInfo = getLevelInfo(goal.level);
                const LevelIcon = levelInfo.icon;

                return (
                  <Card key={goal.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <LevelIcon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle>
                              {goal.seller_name || 'Vendedor'} • {formatPeriod(goal.period_ym)}
                            </CardTitle>
                            <CardDescription>{goal.seller_email}</CardDescription>
                          </div>
                        </div>
                        <Badge className={levelInfo.color}>{levelInfo.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-muted-foreground">Meta de Vendas</span>
                          <span className="text-2xl font-bold">
                            {new Intl.NumberFormat('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                            }).format(goal.sales_goal || 0)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-muted-foreground">Meta de Visitas</span>
                          <span className="text-2xl font-bold">{goal.visits_goal || 0}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm text-muted-foreground">Meta de Propostas</span>
                          <span className="text-2xl font-bold">{goal.proposals_goal || 0}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
