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

    const conversionsLimit = isActive ? 100 : 0; // Pro plan gets 100 conversions

    if (isActive) {
      const { error: upsertError } = await supabaseClient
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          stripe_subscription_id: latestSub?.id || null,
          stripe_customer_id: customerId,
          status,
          plan_type: 'pro',
          conversions_limit: conversionsLimit,
          current_period_start: latestSub?.current_period_start
            ? new Date(latestSub.current_period_start * 1000).toISOString()
            : null,
          current_period_end: subscriptionEnd,
        });
      if (upsertError) {
        console.error('Error upserting active subscription:', upsertError);
        throw new Error(`Failed to update subscription: ${upsertError.message}`);
      }
    } else {
      const { error: upsertError } = await supabaseClient
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          status: 'inactive',
          plan_type: 'free',
          conversions_limit: 0,
          current_period_start: null,
          current_period_end: null,
          stripe_subscription_id: latestSub?.id || null,
        });
      if (upsertError) {
        console.error('Error upserting free subscription:', upsertError);
        throw new Error(`Failed to update subscription: ${upsertError.message}`);
      }
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