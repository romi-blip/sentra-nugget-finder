
-- 1) Ensure the app_role enum has the required values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2) Enforce a single role per user
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
DO $$
BEGIN
  ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3) Update RLS on user_roles so only super_admin can manage roles
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

-- Keep existing "Users can view their own roles" policy as-is.
-- Add a super_admin-wide manage policy
CREATE POLICY "Super admins can manage all roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 4) Add RLS policies for profiles so super_admin can view/edit/delete any
CREATE POLICY "Super admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Super admins can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Super admins can delete any profile"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'::public.app_role));

-- 5) Create a convenience view for listing users with their role
CREATE OR REPLACE VIEW public.user_profiles_with_role AS
SELECT
  p.id         AS user_id,
  p.email,
  p.first_name,
  p.last_name,
  p.department,
  p.created_at,
  p.updated_at,
  ur.role
FROM public.profiles p
LEFT JOIN public.user_roles ur
  ON ur.user_id = p.id;

-- 6) Make Ilan a super_admin (from auth logs: fa23c5d0-def9-4f22-b513-4ce07e4600f0)
DELETE FROM public.user_roles
WHERE user_id = 'fa23c5d0-def9-4f22-b513-4ce07e4600f0'::uuid;

INSERT INTO public.user_roles (user_id, role)
VALUES ('fa23c5d0-def9-4f22-b513-4ce07e4600f0'::uuid, 'super_admin'::public.app_role)
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
