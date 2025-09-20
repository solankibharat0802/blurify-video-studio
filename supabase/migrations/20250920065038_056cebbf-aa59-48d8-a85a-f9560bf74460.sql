-- Add plan_name column to subscriptions table to track specific plan types
ALTER TABLE public.subscriptions 
ADD COLUMN plan_name text DEFAULT 'free';

-- Update existing records to reflect the plan name
UPDATE public.subscriptions 
SET plan_name = CASE 
  WHEN plan_type = 'pro' THEN 'basic'
  WHEN plan_type = 'free' THEN 'free'
  ELSE 'free'
END;

-- Add check constraint for valid plan names
ALTER TABLE public.subscriptions 
ADD CONSTRAINT valid_plan_names 
CHECK (plan_name IN ('free', 'basic', 'unlimited'));