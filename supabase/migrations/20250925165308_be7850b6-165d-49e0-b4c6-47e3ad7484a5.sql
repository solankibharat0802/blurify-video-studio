-- Drop subscription-related tables and functions
DROP TABLE IF EXISTS coupon_usage CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;

-- Remove subscription references from profiles table  
ALTER TABLE profiles DROP COLUMN IF EXISTS subscription_tier;

-- Update handle_new_user function to remove subscription creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  
  RETURN NEW;
END;
$function$;