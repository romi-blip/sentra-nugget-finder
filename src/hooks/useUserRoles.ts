import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  assigned_at: string;
}

export function useUserRoles() {
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<AppRole | null>(null);

  useEffect(() => {
    fetchUserRoles();
  }, []);

  const fetchUserRoles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      // Get current user's role
      const { data: currentRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      setCurrentUserRole(currentRole?.role || null);

      // If user is super_admin, get all roles
      if (currentRole?.role === 'super_admin') {
        const { data: allRoles, error } = await supabase
          .from('user_roles')
          .select(`
            id,
            user_id,
            role,
            assigned_at
          `)
          .order('assigned_at', { ascending: false });

        if (error) throw error;
        setUserRoles(allRoles || []);
      }
    } catch (error) {
      console.error('Error fetching user roles:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const hasRole = useCallback((role: AppRole): boolean => {
    return currentUserRole === role;
  }, [currentUserRole]);

  const hasAnyRole = useCallback((roles: AppRole[]): boolean => {
    return currentUserRole ? roles.includes(currentUserRole) : false;
  }, [currentUserRole]);

  const canAccessKnowledgeBase = (): boolean => {
    return hasAnyRole(['admin', 'super_admin']);
  };

  const canManageWebhooks = (): boolean => {
    return hasRole('super_admin');
  };

  return {
    userRoles,
    currentUserRole,
    isLoading,
    hasRole,
    hasAnyRole,
    canAccessKnowledgeBase,
    canManageWebhooks,
    refetch: fetchUserRoles,
  };
}