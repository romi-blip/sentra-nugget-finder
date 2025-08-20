-- Fix security issue: Implement user-specific RLS policies for contacts table
-- This ensures users can only access contacts from companies associated with their campaigns

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Admins can manage contacts" ON public.contacts;

-- Create new granular policies

-- 1. Super admins can still access all contacts (needed for system management)
CREATE POLICY "Super admins can manage all contacts"
ON public.contacts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- 2. Users can only access contacts from companies associated with their campaigns
CREATE POLICY "Users can view contacts from their campaign companies"
ON public.contacts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.campaigns c
    JOIN public.companies comp ON comp.breach_article_id = c.breach_article_id
    WHERE comp.id = contacts.company_id
    AND c.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- 3. Users can create contacts for companies in their campaigns
CREATE POLICY "Users can create contacts for their campaign companies"
ON public.contacts
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.campaigns c
    JOIN public.companies comp ON comp.breach_article_id = c.breach_article_id
    WHERE comp.id = contacts.company_id
    AND c.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- 4. Users can update contacts from companies in their campaigns
CREATE POLICY "Users can update contacts from their campaign companies"
ON public.contacts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.campaigns c
    JOIN public.companies comp ON comp.breach_article_id = c.breach_article_id
    WHERE comp.id = contacts.company_id
    AND c.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- 5. Users can delete contacts from companies in their campaigns  
CREATE POLICY "Users can delete contacts from their campaign companies"
ON public.contacts
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.campaigns c
    JOIN public.companies comp ON comp.breach_article_id = c.breach_article_id
    WHERE comp.id = contacts.company_id
    AND c.user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Add helpful comment explaining the security model
COMMENT ON TABLE public.contacts IS 'Contacts table with user-specific access control. Users can only access contacts from companies associated with their campaigns. Super admins have full access for system management.';