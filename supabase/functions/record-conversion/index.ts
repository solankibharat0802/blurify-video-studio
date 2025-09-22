import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.id) throw new Error("User not authenticated");

    console.log(`Recording conversion for user: ${user.id}`);

    // Increment the conversion count
    const { data: subscription, error: updateError } = await supabaseClient
      .from('subscriptions')
      .update({ 
        conversions_used: supabaseClient.rpc('increment_conversions_used', { user_uuid: user.id })
      })
      .eq('user_id', user.id)
      .select('conversions_used, conversions_limit')
      .single();

    if (updateError) {
      console.error('Error updating conversion count:', updateError);
      
      // Fallback: manual increment
      const { data: currentSub } = await supabaseClient
        .from('subscriptions')
        .select('conversions_used')
        .eq('user_id', user.id)
        .single();

      const newCount = (currentSub?.conversions_used || 0) + 1;
      
      const { error: fallbackError } = await supabaseClient
        .from('subscriptions')
        .update({ conversions_used: newCount })
        .eq('user_id', user.id);

      if (fallbackError) {
        throw new Error(`Failed to update conversion count: ${fallbackError.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        conversions_used: newCount
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`Conversion recorded. New count: ${subscription.conversions_used}`);

    return new Response(JSON.stringify({
      success: true,
      conversions_used: subscription.conversions_used,
      conversions_limit: subscription.conversions_limit
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error('Error in record-conversion:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});