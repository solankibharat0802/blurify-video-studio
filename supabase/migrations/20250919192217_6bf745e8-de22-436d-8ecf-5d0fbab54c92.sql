-- Create coupons table for admin-generated discount codes
CREATE TABLE public.coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'percentage', -- 'percentage' or 'amount'
  discount_value numeric NOT NULL,
  usage_limit integer,
  used_count integer NOT NULL DEFAULT 0,
  valid_from timestamp with time zone NOT NULL DEFAULT now(),
  valid_until timestamp with time zone,
  stripe_coupon_id text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

-- Enable RLS for coupons
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage coupons
CREATE POLICY "Admins can manage all coupons" 
ON public.coupons 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND is_admin = true
  )
);

-- Allow users to view active coupons for validation
CREATE POLICY "Users can view active coupons for validation" 
ON public.coupons 
FOR SELECT
USING (is_active = true AND (valid_until IS NULL OR valid_until > now()));

-- Create coupon_usage table to track who used which coupons
CREATE TABLE public.coupon_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id),
  used_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(coupon_id, user_id)
);

-- Enable RLS for coupon_usage
ALTER TABLE public.coupon_usage ENABLE ROW LEVEL SECURITY;

-- Allow admins to view all usage
CREATE POLICY "Admins can view all coupon usage" 
ON public.coupon_usage 
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND is_admin = true
  )
);

-- Allow users to view their own usage
CREATE POLICY "Users can view their own coupon usage" 
ON public.coupon_usage 
FOR SELECT
USING (auth.uid() = user_id);

-- Create function to update updated_at for coupons
CREATE TRIGGER update_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add some indexes for performance
CREATE INDEX idx_coupons_code ON public.coupons(code);
CREATE INDEX idx_coupons_active ON public.coupons(is_active) WHERE is_active = true;
CREATE INDEX idx_coupon_usage_coupon_id ON public.coupon_usage(coupon_id);
CREATE INDEX idx_coupon_usage_user_id ON public.coupon_usage(user_id);