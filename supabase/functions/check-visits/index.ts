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

    console.log('🔍 Iniciando verificação de visitas...');

    // Data atual
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // 1. Buscar todas as visitas completadas
    const { data: visits, error: visitsError } = await supabase
      .from('visits')
      .select(`
        id,
        client_id,
        seller_auth_id,
        scheduled_at,
        clients (
          id,
          contact_name,
          seller_auth_id
        )
      `)
      .eq('status', 'completed')
      .order('scheduled_at', { ascending: false });

    if (visitsError) {
      console.error('Erro ao buscar visitas:', visitsError);
      throw visitsError;
    }

    console.log(`📊 Total de visitas completadas: ${visits?.length || 0}`);

    // 2. Agrupar por cliente e encontrar última visita
    const clientLastVisit = new Map<string, { 
      lastVisit: Date; 
      sellerId: string;
      clientName: string;
    }>();

    visits?.forEach(visit => {
      const clientId = visit.client_id;
      const visitDate = new Date(visit.scheduled_at);
      const existing = clientLastVisit.get(clientId);

      if (!existing || visitDate > existing.lastVisit) {
        const clientData = visit.clients as any;
        clientLastVisit.set(clientId, {
          lastVisit: visitDate,
          sellerId: visit.seller_auth_id,
          clientName: clientData?.contact_name || 'Cliente',
        });
      }
    });

    console.log(`👥 Clientes com visitas: ${clientLastVisit.size}`);

    // 3. Buscar admins ativos
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

    console.log(`👨‍💼 Total de admins: ${admins?.length || 0}`);

    let notificationsCreated = 0;

    // 4. Processar cada cliente
    for (const [clientId, info] of clientLastVisit.entries()) {
      const daysSinceLastVisit = Math.floor(
        (now.getTime() - info.lastVisit.getTime()) / (1000 * 60 * 60 * 24)
      );

      // 4a. Notificar vendedor se passaram 30 dias
      if (daysSinceLastVisit >= 30 && daysSinceLastVisit % 30 === 0) {
        console.log(`⏰ Vendedor precisa visitar ${info.clientName} (${daysSinceLastVisit} dias)`);
        
        const { error: notifyError } = await supabase.rpc('create_notification', {
          p_user_auth_id: info.sellerId,
          p_kind: 'warning',
          p_title: 'Visita Pendente',
          p_message: `Já fazem ${daysSinceLastVisit} dias desde a última visita ao cliente ${info.clientName}. Agende uma nova visita!`,
        });

        if (notifyError) {
          console.error('Erro ao criar notificação para vendedor:', notifyError);
        } else {
          notificationsCreated++;
        }
      }

      // 4b. Notificar admin se passaram 90 dias
      if (daysSinceLastVisit >= 90 && daysSinceLastVisit % 90 === 0) {
        console.log(`🚨 Admin: vendedor não visitou ${info.clientName} em ${daysSinceLastVisit} dias`);
        
        for (const admin of admins || []) {
          const { error: notifyError } = await supabase.rpc('create_notification', {
            p_user_auth_id: admin.auth_user_id,
            p_kind: 'alert',
            p_title: 'Cliente Sem Visita há 90+ Dias! ⚠️',
            p_message: `Cliente ${info.clientName} não recebe visita há ${daysSinceLastVisit} dias!`,
          });

          if (notifyError) {
            console.error('Erro ao criar notificação para admin:', notifyError);
          } else {
            notificationsCreated++;
          }
        }
      }
    }

    console.log(`✅ Verificação concluída. ${notificationsCreated} notificações criadas.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        clientsChecked: clientLastVisit.size,
        notificationsCreated,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Erro na verificação de visitas:', error);
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
