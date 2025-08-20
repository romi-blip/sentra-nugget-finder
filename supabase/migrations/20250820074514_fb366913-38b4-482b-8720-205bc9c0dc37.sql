-- Alternative approach: Replace security definer views with regular access patterns
-- The linter might be detecting these views as problematic due to their complexity
-- Let's simplify the access patterns

-- For user_profiles_with_role, since this is used frequently, let's ensure proper access
-- Drop the view and rely on direct table joins with proper RLS
DROP VIEW IF EXISTS user_profiles_with_role CASCADE;

-- Create a simple function instead that respects RLS
CREATE OR REPLACE FUNCTION get_user_profiles_with_roles()
RETURNS TABLE (
  user_id uuid,
  email text,
  first_name text,
  last_name text,
  department text,
  created_at timestamptz,
  updated_at timestamptz,
  role app_role
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT 
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.department,
    p.created_at,
    p.updated_at,
    ur.role
  FROM profiles p
  LEFT JOIN user_roles ur ON ur.user_id = p.id;
$$;

-- For breach_summary, create a function instead of a view
DROP VIEW IF EXISTS breach_summary CASCADE;

CREATE OR REPLACE FUNCTION get_breach_summary()
RETURNS TABLE (
  id uuid,
  url text,
  title text,
  breach_summary text,
  breach_date date,
  impacted_companies bigint,
  competitor_companies bigint,
  total_contacts bigint,
  avg_icp_score numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT 
    ba.id,
    ba.url,
    ba.title,
    ba.breach_summary,
    ba.breach_date,
    COUNT(CASE WHEN c.company_type = 'impacted' THEN 1 END) AS impacted_companies,
    COUNT(CASE WHEN c.company_type = 'competitor' THEN 1 END) AS competitor_companies,
    COUNT(cnt.id) AS total_contacts,
    AVG(c.icp_score) AS avg_icp_score
  FROM breach_articles ba
  LEFT JOIN companies c ON ba.id = c.breach_article_id
  LEFT JOIN contacts cnt ON c.id = cnt.company_id
  GROUP BY ba.id, ba.url, ba.title, ba.breach_summary, ba.breach_date
  ORDER BY ba.created_at DESC;
$$;

-- For high_priority_prospects, create a function instead of a view
DROP VIEW IF EXISTS high_priority_prospects CASCADE;

CREATE OR REPLACE FUNCTION get_high_priority_prospects()
RETURNS TABLE (
  company_id uuid,
  company_name text,
  company_type text,
  industry text,
  annual_revenue text,
  employee_count integer,
  icp_score integer,
  breach_article_url text,
  breach_title text,
  contact_id uuid,
  full_name text,
  title text,
  contact_priority integer,
  outreach_status text,
  impacted_company_name text
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT 
    c.id,
    c.company_name,
    c.company_type,
    c.industry,
    c.annual_revenue,
    c.employee_count,
    c.icp_score,
    ba.url,
    ba.title,
    cnt.id,
    cnt.full_name,
    cnt.title,
    cnt.contact_priority,
    cnt.outreach_status,
    ic.company_name
  FROM companies c
  JOIN breach_articles ba ON c.breach_article_id = ba.id
  LEFT JOIN companies ic ON c.impacted_company_id = ic.id
  JOIN contacts cnt ON c.id = cnt.company_id
  WHERE c.icp_score >= 7 
  AND cnt.persona_type = 'primary'
  AND cnt.outreach_status = 'pending'
  ORDER BY c.icp_score DESC, cnt.contact_priority DESC;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_profiles_with_roles() TO authenticated;
GRANT EXECUTE ON FUNCTION get_breach_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION get_high_priority_prospects() TO authenticated;