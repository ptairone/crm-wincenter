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

    console.log('🔧 Iniciando verificação de serviços...');

    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // 1. Buscar serviços agendados nas próximas 48 horas
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select(`
        id,
        client_id,
        assigned_users,
        service_type,
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
      .lte('date', in48h.toISOString());

    if (servicesError) {
      console.error('Erro ao buscar serviços:', servicesError);
      throw servicesError;
    }

    console.log(`📋 Serviços agendados nas próximas 48h: ${services?.length || 0}`);

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

    // 3. Processar cada serviço
    for (const svc of services || []) {
      const clientName = (svc as any).clients?.contact_name || 'Cliente';
      const serviceTime = new Date(svc.date);

      // Notificar usuários atribuídos e criar tarefa de pré-checagem
      if (Array.isArray(svc.assigned_users) && svc.assigned_users.length > 0) {
        for (const userId of svc.assigned_users) {
          const { error: notifyError } = await supabase.rpc('create_notification', {
            p_user_auth_id: userId,
            p_kind: 'info',
            p_title: 'Pré-checagem de Serviço',
            p_message: `Serviço ${svc.service_type} para ${clientName} em ${serviceTime.toLocaleString()}. Faça a pré-checagem (equipamentos/insumos).`,
          });

          if (!notifyError) notificationsCreated++;

          const { error: taskError } = await supabase.rpc('create_task', {
            p_responsible_auth_id: userId,
            p_type: 'service_precheck',
            p_client_id: svc.client_id,
            p_related_entity_id: svc.id,
            p_due_at: now.toISOString(),
            p_priority: 'medium',
            p_notes: `Pré-checagem do serviço ${svc.service_type} para ${clientName} (até ${serviceTime.toLocaleString()})`,
            p_assigned_users: null,
          });
          if (taskError) {
            console.error('Erro ao criar tarefa de pré-checagem:', taskError);
          }
        }
      } else {
        // Sem usuários atribuídos: avisar admins e criar tarefa de follow-up
        for (const admin of admins || []) {
          const { error: notifyError } = await supabase.rpc('create_notification', {
            p_user_auth_id: admin.auth_user_id,
            p_kind: 'warning',
            p_title: 'Serviço Sem Técnico Atribuído',
            p_message: `Serviço ${svc.service_type} para ${clientName} em ${serviceTime.toLocaleString()} sem responsável. Atribuir técnico.`,
          });

          if (!notifyError) notificationsCreated++;

          const { error: taskError } = await supabase.rpc('create_task', {
            p_responsible_auth_id: admin.auth_user_id,
            p_type: 'followup',
            p_client_id: svc.client_id,
            p_related_entity_id: svc.id,
            p_due_at: now.toISOString(),
            p_priority: 'high',
            p_notes: `Atribuir técnico ao serviço ${svc.service_type} para ${clientName} (${serviceTime.toLocaleString()})`,
            p_assigned_users: null,
          });
          if (taskError) {
            console.error('Erro ao criar tarefa de follow-up (serviço):', taskError);
          }
        }
      }
    }

    console.log(`✅ Verificação concluída. ${notificationsCreated} notificações criadas.`);

    return new Response(
      JSON.stringify({
        success: true,
        servicesChecked: services?.length || 0,
        notificationsCreated,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Erro na verificação de serviços:', error);
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