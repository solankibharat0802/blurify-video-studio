import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CouponInput } from "@/components/coupon-input";

export function SubscriptionPanel() {
  const { session } = useAuth();
  const { subscribed, conversionsLimit, conversionsUsed, subscriptionEnd, loading, refreshSubscription } = useSubscription();
  const [upgrading, setUpgrading] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  
  // Subscription plans
  const plans = {
    basic: {
      name: "Basic Plan",
      price: "$5.00/month",
      price_id: "price_1S9KWrR0oSHMxg8M2vB4CWVL",
      conversions: 100,
      features: ["100 video conversions per month", "Standard processing", "Basic blur effects"]
    },
    unlimited: {
      name: "Unlimited Plan", 
      price: "$9.99/month",
      price_id: "price_1S9KX4R0oSHMxg8M9LsdsJTo",
      conversions: "unlimited",
      features: ["Unlimited video conversions", "Priority processing", "Advanced blur effects", "Premium support"]
    }
  };

  const handleUpgrade = async (plan: 'basic' | 'unlimited') => {
    if (!session) return;
    
    try {
      setUpgrading(true);
      
      // If coupon is applied, apply it first
      if (appliedCoupon) {
        const { data: couponData, error: couponError } = await supabase.functions.invoke('validate-coupon', {
          body: { code: appliedCoupon.code, action: 'apply' },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (couponError || !couponData.valid) {
          toast.error('Failed to apply coupon');
          setUpgrading(false);
          return;
        }
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { price_id: plans[plan].price_id },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Failed to start checkout process');
    } finally {
      setUpgrading(false);
    }
  };

  const handleCouponApplied = (coupon: any) => {
    setAppliedCoupon(coupon);
  };

  const handleCouponRemoved = () => {
    setAppliedCoupon(null);
  };

  if (loading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="animate-pulse">Loading subscription...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const usagePercentage = conversionsLimit > 0 ? (conversionsUsed / conversionsLimit) * 100 : 0;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Subscription Status</CardTitle>
          <Badge variant={subscribed ? "default" : "secondary"}>
            {subscribed ? "Pro" : "Free"}
          </Badge>
        </div>
        <CardDescription>
          {subscribed 
            ? `Active until ${subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString() : 'N/A'}`
            : "Upgrade to Pro for unlimited conversions"
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Conversions Used</span>
            <span>{conversionsUsed} / {conversionsLimit || "0"}</span>
          </div>
          <Progress value={usagePercentage} className="h-2" />
        </div>

        {!subscribed && (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="text-sm font-medium">Have a coupon?</div>
              <CouponInput 
                onCouponApplied={handleCouponApplied}
                onCouponRemoved={handleCouponRemoved}
              />
            </div>

            <div className="grid gap-4">
              {/* Basic Plan */}
              <Card className="border-2">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">{plans.basic.name}</CardTitle>
                    <Badge variant="outline">{plans.basic.price}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="text-sm space-y-1">
                    {plans.basic.features.map((feature, index) => (
                      <li key={index}>• {feature}</li>
                    ))}
                  </ul>
                  <Button 
                    onClick={() => handleUpgrade('basic')} 
                    disabled={upgrading}
                    variant="outline"
                    className="w-full"
                  >
                    {upgrading ? "Processing..." : `Choose Basic${appliedCoupon ? ' (Discount Applied)' : ''}`}
                  </Button>
                </CardContent>
              </Card>

              {/* Unlimited Plan */}
              <Card className="border-2 border-primary">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">{plans.unlimited.name}</CardTitle>
                    <Badge>{plans.unlimited.price}</Badge>
                  </div>
                  <Badge className="w-fit mb-2" variant="secondary">Most Popular</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="text-sm space-y-1">
                    {plans.unlimited.features.map((feature, index) => (
                      <li key={index}>• {feature}</li>
                    ))}
                  </ul>
                  <Button 
                    onClick={() => handleUpgrade('unlimited')} 
                    disabled={upgrading}
                    className="w-full"
                  >
                    {upgrading ? "Processing..." : `Choose Unlimited${appliedCoupon ? ' (Discount Applied)' : ''}`}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {subscribed && (
          <div className="text-sm text-green-600">
            ✓ You have access to all Pro features
          </div>
        )}

        <Button 
          variant="outline" 
          onClick={refreshSubscription}
          className="w-full"
        >
          Refresh Status
        </Button>
      </CardContent>
    </Card>
  );
}