
-- 1) Ensure the 'super_admin' role exists in the enum (safe if already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'super_admin';
  END IF;
END
$$;

-- 2) Ensure a profiles row exists for ilan@sentra.io
WITH u AS (
  SELECT id, email
  FROM auth.users
  WHERE email ILIKE 'ilan@sentra.io'
  LIMIT 1
)
INSERT INTO public.profiles (id, email)
SELECT u.id, u.email
FROM u
ON CONFLICT (id) DO NOTHING;

-- 3) Make ilan a single-role super_admin (remove any existing roles, then set super_admin)
DELETE FROM public.user_roles
WHERE user_id IN (
  SELECT id FROM public.profiles WHERE email ILIKE 'ilan@sentra.io'
);

INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'super_admin'::public.app_role
FROM public.profiles p
WHERE p.email ILIKE 'ilan@sentra.io'
ON CONFLICT DO NOTHING;
