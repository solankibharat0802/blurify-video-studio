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
    if (!user) throw new Error("User not authenticated");

    const { code, action } = await req.json();
    if (!code) throw new Error("Coupon code is required");

    // Get coupon details
    const { data: coupon, error: couponError } = await supabaseClient
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    if (couponError) throw couponError;
    if (!coupon) {
      return new Response(JSON.stringify({ 
        valid: false, 
        error: "Invalid coupon code" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check if coupon is expired
    if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
      return new Response(JSON.stringify({ 
        valid: false, 
        error: "Coupon has expired" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check usage limit
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      return new Response(JSON.stringify({ 
        valid: false, 
        error: "Coupon usage limit reached" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Check if user has already used this coupon
    const { data: existingUsage } = await supabaseClient
      .from('coupon_usage')
      .select('id')
      .eq('coupon_id', coupon.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingUsage) {
      return new Response(JSON.stringify({ 
        valid: false, 
        error: "You have already used this coupon" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // If action is 'apply', mark the coupon as used
    if (action === 'apply') {
      // Record the usage
      const { error: usageError } = await supabaseClient
        .from('coupon_usage')
        .insert({
          coupon_id: coupon.id,
          user_id: user.id
        });

      if (usageError) throw usageError;

      // Increment used count
      const { error: updateError } = await supabaseClient
        .from('coupons')
        .update({ used_count: coupon.used_count + 1 })
        .eq('id', coupon.id);

      if (updateError) throw updateError;
    }

    return new Response(JSON.stringify({
      valid: true,
      coupon: {
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        applied: action === 'apply'
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});