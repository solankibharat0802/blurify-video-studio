import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, X, Percent, DollarSign } from "lucide-react";

interface CouponInputProps {
  onCouponApplied?: (coupon: any) => void;
  onCouponRemoved?: () => void;
}

export function CouponInput({ onCouponApplied, onCouponRemoved }: CouponInputProps) {
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const validateCoupon = async () => {
    if (!couponCode.trim()) {
      toast.error("Please enter a coupon code");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-coupon', {
        body: { code: couponCode.trim(), action: 'validate' }
      });

      if (error) throw error;

      if (data.valid) {
        const couponData = {
          ...data.coupon,
          originalCode: couponCode.trim()
        };
        setAppliedCoupon(couponData);
        onCouponApplied?.(couponData);
        toast.success(`Coupon "${couponCode}" applied successfully!`);
        setCouponCode("");
      } else {
        toast.error(data.error || "Invalid coupon code");
      }
    } catch (error) {
      console.error('Error validating coupon:', error);
      toast.error('Failed to validate coupon');
    } finally {
      setLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    onCouponRemoved?.();
    toast.success("Coupon removed");
  };

  const applyCoupon = async () => {
    if (!appliedCoupon) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-coupon', {
        body: { code: appliedCoupon.code, action: 'apply' }
      });

      if (error) throw error;

      if (data.valid && data.coupon.applied) {
        toast.success("Coupon applied to your subscription!");
        return true;
      } else {
        toast.error("Failed to apply coupon");
        return false;
      }
    } catch (error) {
      console.error('Error applying coupon:', error);
      toast.error('Failed to apply coupon');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const formatDiscountValue = (coupon: any) => {
    if (coupon.discount_type === 'percentage') {
      return `${coupon.discount_value}% off`;
    } else {
      return `$${coupon.discount_value} off`;
    }
  };

  return (
    <div className="space-y-4">
      {!appliedCoupon ? (
        <div className="flex gap-2">
          <Input
            placeholder="Enter coupon code"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            className="flex-1"
            disabled={loading}
          />
          <Button
            onClick={validateCoupon}
            disabled={loading || !couponCode.trim()}
            variant="outline"
          >
            {loading ? "Validating..." : "Apply"}
          </Button>
        </div>
      ) : (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono">
                      {appliedCoupon.code}
                    </Badge>
                    <div className="flex items-center gap-1 text-green-700">
                      {appliedCoupon.discount_type === 'percentage' ? (
                        <Percent className="h-4 w-4" />
                      ) : (
                        <DollarSign className="h-4 w-4" />
                      )}
                      <span className="font-medium">
                        {formatDiscountValue(appliedCoupon)}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-green-600">
                    Coupon validated and ready to apply
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={removeCoupon}
                className="text-red-600 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}