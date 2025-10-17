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

    console.log('📦 Iniciando verificação de estoque...');

    // 1. Buscar produtos ativos
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, stock, low_stock_threshold')
      .eq('status', 'active');

    if (productsError) {
      console.error('Erro ao buscar produtos:', productsError);
      throw productsError;
    }

    console.log(`📊 Total de produtos ativos: ${products?.length || 0}`);

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

    console.log(`👨‍💼 Total de admins: ${admins?.length || 0}`);

    if (!admins || admins.length === 0) {
      console.log('⚠️ Nenhum admin encontrado para notificar');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum admin para notificar' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let notificationsCreated = 0;
    const outOfStock: string[] = [];
    const lowStock: string[] = [];

    // 3. Verificar estoque de cada produto
    for (const product of products || []) {
      if (product.stock === 0) {
        outOfStock.push(product.name);
      } else if (product.stock <= product.low_stock_threshold) {
        lowStock.push(product.name);
      }
    }

    console.log(`🚫 Produtos sem estoque: ${outOfStock.length}`);
    console.log(`⚠️ Produtos com estoque baixo: ${lowStock.length}`);

    // 4. Criar notificações para produtos sem estoque
    if (outOfStock.length > 0) {
      for (const admin of admins) {
        const message = outOfStock.length === 1
          ? `Produto "${outOfStock[0]}" está SEM ESTOQUE!`
          : `${outOfStock.length} produtos estão SEM ESTOQUE: ${outOfStock.slice(0, 3).join(', ')}${outOfStock.length > 3 ? '...' : ''}`;

        const { error: notifyError } = await supabase.rpc('create_notification', {
          p_user_auth_id: admin.auth_user_id,
          p_kind: 'alert',
          p_title: 'Produtos Sem Estoque! ⚠️',
          p_message: message,
        });

        if (notifyError) {
          console.error('Erro ao criar notificação (sem estoque):', notifyError);
        } else {
          notificationsCreated++;
        }
      }
    }

    // 5. Criar notificações para produtos com estoque baixo
    if (lowStock.length > 0) {
      for (const admin of admins) {
        const message = lowStock.length === 1
          ? `Produto "${lowStock[0]}" está com estoque baixo!`
          : `${lowStock.length} produtos com estoque baixo: ${lowStock.slice(0, 3).join(', ')}${lowStock.length > 3 ? '...' : ''}`;

        const { error: notifyError } = await supabase.rpc('create_notification', {
          p_user_auth_id: admin.auth_user_id,
          p_kind: 'warning',
          p_title: 'Estoque Baixo',
          p_message: message,
        });

        if (notifyError) {
          console.error('Erro ao criar notificação (estoque baixo):', notifyError);
        } else {
          notificationsCreated++;
        }
      }
    }

    console.log(`✅ Verificação concluída. ${notificationsCreated} notificações criadas.`);

    return new Response(
      JSON.stringify({ 
        success: true,
        productsChecked: products?.length || 0,
        outOfStock: outOfStock.length,
        lowStock: lowStock.length,
        notificationsCreated,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Erro na verificação de estoque:', error);
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
