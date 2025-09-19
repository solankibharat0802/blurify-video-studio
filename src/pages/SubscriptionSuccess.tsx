import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";

const SubscriptionSuccess = () => {
  const navigate = useNavigate();
  const { refreshSubscription } = useSubscription();

  useEffect(() => {
    // Refresh subscription status when user arrives on success page
    refreshSubscription();
    toast.success("Subscription activated successfully!");
  }, [refreshSubscription]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 text-green-600">
            <CheckCircle className="h-12 w-12" />
          </div>
          <CardTitle className="text-2xl">Welcome to Pro!</CardTitle>
          <CardDescription>
            Your subscription has been activated successfully
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              You now have access to:
            </p>
            <ul className="text-sm space-y-1">
              <li>• 100 video conversions per month</li>
              <li>• Priority processing</li>
              <li>• Advanced blur effects</li>
            </ul>
          </div>
          
          <Button 
            onClick={() => navigate("/")} 
            className="w-full"
          >
            Start Converting Videos
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionSuccess;