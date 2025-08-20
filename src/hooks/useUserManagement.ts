
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface UserProfile {
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  department?: string;
  role?: AppRole;
  created_at: string;
  updated_at: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  role?: AppRole;
}

export const useUserManagement = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .rpc('get_user_profiles_with_roles');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch users',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createUser = useCallback(async (userData: CreateUserData) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: userData
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'User created successfully',
      });

      await fetchUsers(); // Refresh the list
      return data;
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create user',
        variant: 'destructive',
      });
      throw error;
    }
  }, [fetchUsers]);

  const updateUserProfile = useCallback(async (userId: string, updates: Partial<UserProfile>) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          first_name: updates.first_name,
          last_name: updates.last_name,
          department: updates.department,
        })
        .eq('id', userId)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('No profile found to update. The profile may not exist.');
      }

      toast({
        title: 'Success',
        description: 'Profile updated successfully',
      });

      await fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
      throw error;
    }
  }, [fetchUsers]);

  const updateUserRole = useCallback(async (userId: string, role: AppRole) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: role
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Role updated successfully',
      });

      await fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'Error',
        description: 'Failed to update role',
        variant: 'destructive',
      });
      throw error;
    }
  }, [fetchUsers]);

  const deleteUser = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId }
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'User deleted successfully',
      });

      await fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete user',
        variant: 'destructive',
      });
      throw error;
    }
  }, [fetchUsers]);

  return {
    users,
    isLoading,
    fetchUsers,
    createUser,
    updateUserProfile,
    updateUserRole,
    deleteUser,
  };
};
