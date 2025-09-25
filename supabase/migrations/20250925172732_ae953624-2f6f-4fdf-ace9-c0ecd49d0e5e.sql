-- Add conversion limits and subscription management
ALTER TABLE public.profiles 
ADD COLUMN conversion_limit integer DEFAULT 5,
ADD COLUMN subscription_active boolean DEFAULT false,
ADD COLUMN subscription_start_date timestamp with time zone,
ADD COLUMN subscription_end_date timestamp with time zone,
ADD COLUMN conversions_used integer DEFAULT 0;

-- Create a function to check if user can convert
CREATE OR REPLACE FUNCTION public.can_user_convert(user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    CASE 
      WHEN subscription_active = true AND subscription_end_date > now() THEN true
      WHEN conversions_used < conversion_limit THEN true
      ELSE false
    END
  FROM public.profiles 
  WHERE user_id = user_uuid;
$$;

-- Create a function to increment conversion count
CREATE OR REPLACE FUNCTION public.increment_user_conversions(user_uuid uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE public.profiles 
  SET conversions_used = conversions_used + 1
  WHERE user_id = user_uuid;
$$;

-- Create a function to check and update expired subscriptions
CREATE OR REPLACE FUNCTION public.update_expired_subscriptions()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  UPDATE public.profiles 
  SET subscription_active = false
  WHERE subscription_active = true 
    AND subscription_end_date <= now();
$$;