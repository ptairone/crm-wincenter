import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('🎯 Iniciando verificação de demonstrações...');

    const now = new Date();
    const in72h = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    // 1. Buscar demonstrações agendadas nas próximas 72 horas
    const { data: demos, error: demosError } = await supabase
      .from('demonstrations')
      .select(`
        id,
        client_id,
        assigned_users,
        demo_types,
        date,
        status,
        clients (
          id,
          contact_name,
          seller_auth_id
        )
      `)
      .eq('status', 'scheduled')
      .gte('date', now.toISOString())
      .lte('date', in72h.toISOString());

    if (demosError) {
      console.error('Erro ao buscar demonstrações:', demosError);
      throw demosError;
    }

    console.log(`📋 Demonstrações agendadas nas próximas 72h: ${demos?.length || 0}`);

    // 2. Buscar admins ativos
    const { data: admins, error: adminsError } = await supabase
      .from('users')
      .select('auth_user_id')
      .eq('role', 'admin')
      .eq('status', 'active')
      .not('auth_user_id', 'is', null);

    if (adminsError) {
      console.error('Erro ao buscar admins:', adminsError);
      throw adminsError;
    }

    let notificationsCreated = 0;

    // 3. Processar cada demonstração
    for (const demo of demos || []) {
      const clientName = (demo as any).clients?.contact_name || 'Cliente';
      const demoTime = new Date(demo.date);
      const typesLabel = Array.isArray(demo.demo_types) && demo.demo_types.length > 0
        ? demo.demo_types.join(', ')
        : 'demonstração';

      // Notificar usuários atribuídos e criar tarefa de preparação
      if (Array.isArray(demo.assigned_users) && demo.assigned_users.length > 0) {
        for (const userId of demo.assigned_users) {
          const { error: notifyError } = await supabase.rpc('create_notification', {
            p_user_auth_id: userId,
            p_kind: 'info',
            p_title: 'Preparação de Demonstração',
            p_message: `Preparar ${typesLabel} para ${clientName} em ${demoTime.toLocaleString()} (materiais/equipamentos).`,
          });

          if (!notifyError) notificationsCreated++;

          const { error: taskError } = await supabase.rpc('create_task', {
            p_responsible_auth_id: userId,
            p_type: 'demo_prepare',
            p_client_id: demo.client_id,
            p_related_entity_id: demo.id,
            p_due_at: now.toISOString(),
            p_priority: 'medium',
            p_notes: `Preparar ${typesLabel} para ${clientName} (até ${demoTime.toLocaleString()})`,
            p_assigned_users: null,
          });
          if (taskError) {
            console.error('Erro ao criar tarefa de preparação de demo:', taskError);
          }
        }
      } else {
        // Sem usuários atribuídos: avisar admins e criar tarefa de follow-up
        for (const admin of admins || []) {
          const { error: notifyError } = await supabase.rpc('create_notification', {
            p_user_auth_id: admin.auth_user_id,
            p_kind: 'warning',
            p_title: 'Demonstração Sem Responsável',
            p_message: `Demonstração (${typesLabel}) para ${clientName} em ${demoTime.toLocaleString()} sem responsável. Atribuir equipe.`,
          });

          if (!notifyError) notificationsCreated++;

          const { error: taskError } = await supabase.rpc('create_task', {
            p_responsible_auth_id: admin.auth_user_id,
            p_type: 'followup',
            p_client_id: demo.client_id,
            p_related_entity_id: demo.id,
            p_due_at: now.toISOString(),
            p_priority: 'high',
            p_notes: `Atribuir responsáveis à ${typesLabel} para ${clientName} (${demoTime.toLocaleString()})`,
            p_assigned_users: null,
          });
          if (taskError) {
            console.error('Erro ao criar tarefa de follow-up (demo):', taskError);
          }
        }
      }
    }

    console.log(`✅ Verificação concluída. ${notificationsCreated} notificações criadas.`);

    return new Response(
      JSON.stringify({
        success: true,
        demonstrationsChecked: demos?.length || 0,
        notificationsCreated,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Erro na verificação de demonstrações:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});