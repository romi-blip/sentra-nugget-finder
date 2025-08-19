import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRoles } from '@/hooks/useUserRoles';
import { Navigate } from 'react-router-dom';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
  requiredRoles?: AppRole[];
  redirectTo?: string;
}

export default function ProtectedRoute({ 
  children, 
  requireAuth = true, 
  requiredRoles = [],
  redirectTo = '/auth' 
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { currentUserRole, isLoading: rolesLoading } = useUserRoles();

  // Show loading while checking auth status
  if (loading || rolesLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Check authentication requirement
  if (requireAuth && !user) {
    return <Navigate to={redirectTo} replace />;
  }

  // Check role requirements
  if (requiredRoles.length > 0 && (!currentUserRole || !requiredRoles.includes(currentUserRole))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}