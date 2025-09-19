import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/header";
import { SubscriptionPanel } from "@/components/subscription-panel";
import { useAuth } from "@/hooks/useAuth";

const Subscription = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 bg-primary rounded-full animate-pulse mx-auto"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Subscription</h1>
            <p className="text-muted-foreground">
              Manage your subscription and billing
            </p>
          </div>
          <div className="max-w-2xl">
            <SubscriptionPanel />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Subscription;