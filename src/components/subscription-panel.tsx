import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function SubscriptionPanel() {
  const { session } = useAuth();
  const { subscribed, conversionsLimit, conversionsUsed, subscriptionEnd, loading, refreshSubscription } = useSubscription();
  const [upgrading, setUpgrading] = useState(false);

  const handleUpgrade = async () => {
    if (!session) return;
    
    try {
      setUpgrading(true);
      const { data, error } = await supabase.functions.invoke('create-checkout', {
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
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Upgrade to Pro to get:
            </div>
            <ul className="text-sm space-y-1">
              <li>• 100 video conversions per month</li>
              <li>• Priority processing</li>
              <li>• Advanced blur effects</li>
            </ul>
            <Button 
              onClick={handleUpgrade} 
              disabled={upgrading}
              className="w-full"
            >
              {upgrading ? "Processing..." : "Upgrade to Pro - $9.99/month"}
            </Button>
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