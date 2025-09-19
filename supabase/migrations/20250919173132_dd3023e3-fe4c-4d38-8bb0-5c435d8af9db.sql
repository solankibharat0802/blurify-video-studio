-- Enable RLS on uploadvideo table (it was missing)
ALTER TABLE public.uploadvideo ENABLE ROW LEVEL SECURITY;

-- Fix search_path for existing functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (
    NEW.id, 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email)
  );
  
  -- Create default subscription
  INSERT INTO public.subscriptions (user_id, plan_type, conversions_limit)
  VALUES (NEW.id, 'free', 0);
  
  RETURN NEW;
END;
$function$;