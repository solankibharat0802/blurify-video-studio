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
      status: "active",
      limit: 1,
    });

    const hasActiveSub = subscriptions.data.length > 0;
    let subscriptionEnd = null;
    let conversionsLimit = 0;

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      conversionsLimit = 100; // Pro plan gets 100 conversions

      // Update subscription in database
      const { error: upsertError } = await supabaseClient
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customerId,
          status: 'active',
          plan_type: 'pro',
          conversions_limit: 100,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: subscriptionEnd
        });
      
      if (upsertError) {
        console.error('Error upserting active subscription:', upsertError);
        throw new Error(`Failed to update subscription: ${upsertError.message}`);
      }
    } else {
      // Update to free plan
      const { error: upsertError } = await supabaseClient
        .from('subscriptions')
        .upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          status: 'inactive',
          plan_type: 'free',
          conversions_limit: 0
        });
      
      if (upsertError) {
        console.error('Error upserting free subscription:', upsertError);
        throw new Error(`Failed to update subscription: ${upsertError.message}`);
      }
    }

    // Get current usage
    const { data: subscription } = await supabaseClient
      .from('subscriptions')
      .select('conversions_used')
      .eq('user_id', user.id)
      .single();

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