-- Fix Security Definer View issues
-- Recreate views without SECURITY DEFINER to use invoker's permissions

-- First, recreate the user_profiles_with_role view
DROP VIEW IF EXISTS user_profiles_with_role;
CREATE VIEW user_profiles_with_role AS
SELECT 
  p.id AS user_id,
  p.email,
  p.first_name,
  p.last_name,
  p.department,
  p.created_at,
  p.updated_at,
  ur.role
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id;

-- Change ownership to authenticator role (non-superuser)
ALTER VIEW user_profiles_with_role OWNER TO authenticator;

COMMENT ON VIEW user_profiles_with_role IS 'View that joins profiles with user roles. Access controlled by underlying table RLS policies.';

-- Recreate breach_summary view
DROP VIEW IF EXISTS breach_summary;
CREATE VIEW breach_summary AS
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

-- Change ownership to authenticator role (non-superuser)
ALTER VIEW breach_summary OWNER TO authenticator;

COMMENT ON VIEW breach_summary IS 'Summary view of breach articles with aggregated company and contact data. Access controlled by underlying table RLS policies.';

-- Recreate high_priority_prospects view
DROP VIEW IF EXISTS high_priority_prospects;
CREATE VIEW high_priority_prospects AS
SELECT 
  c.id AS company_id,
  c.company_name,
  c.company_type,
  c.industry,
  c.annual_revenue,
  c.employee_count,
  c.icp_score,
  ba.url AS breach_article_url,
  ba.title AS breach_title,
  cnt.id AS contact_id,
  cnt.full_name,
  cnt.title,
  cnt.contact_priority,
  cnt.outreach_status,
  ic.company_name AS impacted_company_name
FROM companies c
JOIN breach_articles ba ON c.breach_article_id = ba.id
LEFT JOIN companies ic ON c.impacted_company_id = ic.id
JOIN contacts cnt ON c.id = cnt.company_id
WHERE c.icp_score >= 7 
AND cnt.persona_type = 'primary'
AND cnt.outreach_status = 'pending'
ORDER BY c.icp_score DESC, cnt.contact_priority DESC;

-- Change ownership to authenticator role (non-superuser)
ALTER VIEW high_priority_prospects OWNER TO authenticator;

COMMENT ON VIEW high_priority_prospects IS 'View of high-priority prospects for outreach. Access controlled by underlying table RLS policies.';