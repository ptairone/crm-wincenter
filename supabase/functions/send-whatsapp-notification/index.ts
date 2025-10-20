import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationData {
  id: string;
  user_auth_id: string;
  kind: string;
  title: string;
  message: string;
  category: string | null;
  created_at: string;
  client_id?: string | null;
}

interface UserData {
  name: string;
  email: string;
  phone: string | null;
}

interface ClientData {
  contact_name: string | null;
  phone: string | null;
  whatsapp: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { notification_id } = await req.json();

    if (!notification_id) {
      console.error('❌ notification_id não fornecido');
      return new Response(
        JSON.stringify({ error: 'notification_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📱 Processando notificação:', notification_id);

    // Inicializar Supabase client com service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar notificação
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .select('*')
      .eq('id', notification_id)
      .single<NotificationData>();

    if (notificationError || !notification) {
      console.error('❌ Erro ao buscar notificação:', notificationError);
      return new Response(
        JSON.stringify({ error: 'Notificação não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enviar todas as notificações para o webhook (sem filtro por categoria)
    console.log('✅ Enviando notificação para webhook. Categoria:', notification.category);

    // Buscar dados do usuário
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('name, email, phone')
      .eq('auth_user_id', notification.user_auth_id)
      .single<UserData>();

    if (userError || !user) {
      console.error('❌ Erro ao buscar usuário:', userError);
      return new Response(
        JSON.stringify({ error: 'Usuário não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('👤 Usuário encontrado:', user.name);

    // Buscar dados do cliente, se houver vínculo na notificação
    let client: ClientData | null = null;
    if (notification.client_id) {
      const { data: clientsData, error: clientError } = await supabase
        .from('clients')
        .select('contact_name, phone, whatsapp')
        .eq('id', notification.client_id)
        .limit(1);

      if (clientError) {
        console.warn('⚠️ Erro ao buscar cliente (não bloqueante):', clientError);
      }
      client = clientsData && clientsData.length > 0 ? (clientsData[0] as ClientData) : null;
    }

    // Mapear categoria para label em português
    const categoryLabels: Record<string, string> = {
      'service_maintenance': '🔧 Manutenção',
      'service_revision': '🔍 Revisão',
      'service_spraying': '🚁 Pulverização',
      'demonstration': '📊 Demonstração',
      'sale': '💰 Venda',
      'commission': '💵 Comissão',
      'task': '📝 Tarefa'
    };

    const categoryLabel = categoryLabels[notification.category || ''] || (notification.category || 'Notificação');

    // Preparar payload para n8n
    const webhookUrl = Deno.env.get('N8N_WHATSAPP_WEBHOOK_URL');
    
    if (!webhookUrl) {
      console.error('❌ N8N_WHATSAPP_WEBHOOK_URL não configurado');
      return new Response(
        JSON.stringify({ error: 'Webhook URL não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Compor texto padrão, incluindo cliente se disponível
    const clientName = client?.contact_name || null;
    const clientPhoneRaw = client?.whatsapp || client?.phone || null;
    const clientPhone = clientPhoneRaw ? clientPhoneRaw.replace(/\D/g, '') : null;

    const composedMessageBase = `Notificação: ${categoryLabel}\nResponsável: ${user.name}`;
    const composedMessage = clientName
      ? `${composedMessageBase}\nCliente: ${clientName}\nMensagem: ${notification.message}`
      : `${composedMessageBase}\nMensagem: ${notification.message}`;

    const payload = {
      // Dados do usuário (responsável)
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phone,
      userLabel: 'Responsável',

      // Dados do cliente (quando disponíveis)
      clientId: notification.client_id || null,
      clientName: clientName,
      clientPhone: clientPhone,
      clientWhatsapp: client?.whatsapp || null,
      recipientPhone: clientPhone || user.phone || null,
      recipientLabel: clientPhone ? 'Cliente' : 'Responsável',

      // Metadados da notificação
      categoryLabel: categoryLabel,
      notificationTitle: notification.title,
      notificationMessage: composedMessage,
      message: composedMessage,
      notificationKind: notification.kind,
      notificationId: notification.id,
      timestamp: notification.created_at,
      whatsAppText: composedMessage,
    };

    console.log('📤 Enviando para n8n:', { recipient: payload.recipientLabel, category: notification.category });

    // Enviar para n8n
    const n8nResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error('⚠️ Falha ao enviar para n8n (não bloqueante):', errorText);
      
      // Retornar sucesso parcial - não bloqueia o fluxo
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Notificação processada, mas WhatsApp falhou',
          whatsapp_sent: false,
          error: errorText
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Mensagem enviada com sucesso para n8n');

    // Marcar notificação como enviada
    const { error: updateError } = await supabase
      .from('notifications')
      .update({ 
        whatsapp_sent: true, 
        whatsapp_sent_at: new Date().toISOString() 
      })
      .eq('id', notification_id);

    if (updateError) {
      console.error('⚠️ Erro ao marcar notificação como enviada:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Notificação enviada para WhatsApp',
        whatsapp_sent: true
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('❌ Erro geral:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
