import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
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
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { 
      apiVersion: "2025-08-27.basil" 
    });

    // Check for Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ 
        subscribed: false, 
        conversions_limit: 0,
        conversions_used: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
    });

    const latestSub = subscriptions.data[0];
    const status = latestSub?.status || 'canceled';
    const isActive = ['active', 'trialing', 'past_due'].includes(status);

    let subscriptionEnd: string | null = null;
    if (latestSub?.current_period_end) {
      try {
        subscriptionEnd = new Date(latestSub.current_period_end * 1000).toISOString();
      } catch {
        subscriptionEnd = null;
      }
    }

    // Determine conversion limits based on price ID
    let conversionsLimit = 0; // Default for inactive subscriptions
    if (isActive && latestSub) {
      const priceId = latestSub.items.data[0]?.price?.id;
      if (priceId === "price_1S9KX4R0oSHMxg8M9LsdsJTo") { // Unlimited plan
        conversionsLimit = 999999; // Very high number for "unlimited"
      } else if (priceId === "price_1S9KWrR0oSHMxg8M2vB4CWVL") { // Basic plan ($5)
        conversionsLimit = 100;
      } else {
        conversionsLimit = 100; // Default to basic plan limits
      }
    }

    // Update subscription with proper conflict resolution
    const subscriptionData = {
      user_id: user.id,
      stripe_customer_id: customerId,
      status: isActive ? status : 'inactive',
      plan_type: isActive ? 'pro' : 'free',
      conversions_limit: conversionsLimit,
      current_period_start: isActive && latestSub?.current_period_start
        ? new Date(latestSub.current_period_start * 1000).toISOString()
        : null,
      current_period_end: isActive ? subscriptionEnd : null,
      stripe_subscription_id: latestSub?.id || null,
    };

    const { error: upsertError } = await supabaseClient
      .from('subscriptions')
      .upsert(subscriptionData, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      });

    if (upsertError) {
      console.error('Error updating subscription:', upsertError);
      // Don't throw error, just log it and continue
    }

    const hasActiveSub = isActive;

    // Get current usage
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('conversions_used')
      .eq('user_id', user.id)
      .maybeSingle();

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      conversions_limit: conversionsLimit,
      conversions_used: subscription?.conversions_used || 0,
      subscription_end: subscriptionEnd
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