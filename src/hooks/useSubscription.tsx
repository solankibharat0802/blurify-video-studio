import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionContextType {
  subscribed: boolean;
  conversionsLimit: number;
  conversionsUsed: number;
  subscriptionEnd: string | null;
  loading: boolean;
  refreshSubscription: () => Promise<void>;
  canConvert: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [subscribed, setSubscribed] = useState(false);
  const [conversionsLimit, setConversionsLimit] = useState(0);
  const [conversionsUsed, setConversionsUsed] = useState(0);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, session } = useAuth();

  const refreshSubscription = async () => {
    if (!user || !session) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('check-subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      setSubscribed(data.subscribed || false);
      setConversionsLimit(data.conversions_limit || 0);
      setConversionsUsed(data.conversions_used || 0);
      setSubscriptionEnd(data.subscription_end || null);
    } catch (error) {
      console.error('Error checking subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSubscription();
  }, [user, session]);

  // Auto-refresh every minute
  useEffect(() => {
    const interval = setInterval(refreshSubscription, 60000);
    return () => clearInterval(interval);
  }, [user, session]);

  const canConvert = subscribed && conversionsUsed < conversionsLimit;

  const value = {
    subscribed,
    conversionsLimit,
    conversionsUsed,
    subscriptionEnd,
    loading,
    refreshSubscription,
    canConvert,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return context;
}