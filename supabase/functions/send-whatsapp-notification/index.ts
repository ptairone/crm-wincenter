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
}

interface UserData {
  name: string;
  email: string;
  phone: string | null;
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

    // Filtrar apenas categorias que devem ser enviadas para WhatsApp
    const allowedCategories = [
      'service_maintenance',
      'service_revision',
      'service_spraying',
      'demonstration',
      'sale',
      'commission'
    ];

    if (!notification.category || !allowedCategories.includes(notification.category)) {
      console.log('ℹ️ Categoria não permitida para WhatsApp:', notification.category);
      return new Response(
        JSON.stringify({ message: 'Categoria não requer envio para WhatsApp' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Categoria permitida:', notification.category);

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

    // Mapear categoria para label em português
    const categoryLabels: Record<string, string> = {
      'service_maintenance': '🔧 Manutenção',
      'service_revision': '🔍 Revisão',
      'service_spraying': '🚁 Pulverização',
      'demonstration': '📊 Demonstração',
      'sale': '💰 Venda',
      'commission': '💵 Comissão'
    };

    const categoryLabel = categoryLabels[notification.category] || notification.category;

    // Preparar payload para n8n
    const webhookUrl = Deno.env.get('N8N_WHATSAPP_WEBHOOK_URL');
    
    if (!webhookUrl) {
      console.error('❌ N8N_WHATSAPP_WEBHOOK_URL não configurado');
      return new Response(
        JSON.stringify({ error: 'Webhook URL não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payload = {
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phone,
      categoryLabel: categoryLabel,
      notificationTitle: notification.title,
      notificationMessage: notification.message,
      notificationKind: notification.kind,
      notificationId: notification.id,
      timestamp: notification.created_at
    };

    console.log('📤 Enviando para n8n:', { userName: user.name, category: notification.category });

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
