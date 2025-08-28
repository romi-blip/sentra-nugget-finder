-- Fix security issue: Restrict sensitive table policies to authenticated users only
-- This ensures that anonymous users cannot access sensitive business data

-- Update companies table policies to authenticated users only
DROP POLICY IF EXISTS "Admins can manage companies" ON public.companies;
CREATE POLICY "Admins can manage companies" 
ON public.companies 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Update event_leads table policies to authenticated users only  
DROP POLICY IF EXISTS "Admins can manage event leads" ON public.event_leads;
CREATE POLICY "Admins can manage event leads" 
ON public.event_leads 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Update profiles table policies to authenticated users only
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- Ensure no data can be inserted into sensitive tables without proper authentication
-- Add explicit deny policy for anonymous users on all sensitive tables
CREATE POLICY "Deny anonymous access to companies" 
ON public.companies 
FOR ALL 
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny anonymous access to event_leads" 
ON public.event_leads 
FOR ALL 
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny anonymous access to contacts" 
ON public.contacts 
FOR ALL 
TO anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny anonymous access to profiles" 
ON public.profiles 
FOR ALL 
TO anon
USING (false)
WITH CHECK (false);