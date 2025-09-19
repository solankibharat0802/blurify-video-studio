-- Add foreign key relationship between subscriptions and profiles
ALTER TABLE public.subscriptions 
ADD CONSTRAINT subscriptions_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;