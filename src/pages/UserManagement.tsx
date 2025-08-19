
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useUserManagement, type UserProfile } from '@/hooks/useUserManagement';
import { CreateUserDialog } from '@/components/admin/CreateUserDialog';
import { UserRoleSelect } from '@/components/admin/UserRoleSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit2, Save, X, Users, Shield, UserPlus, Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const UserManagement = () => {
  const { user } = useAuth();
  const { currentUserRole, isLoading: rolesLoading } = useUserRoles();
  const {
    users,
    isLoading,
    fetchUsers,
    updateUserProfile,
    updateUserRole,
    deleteUser,
  } = useUserManagement();

  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});

  useEffect(() => {
    if (currentUserRole === 'super_admin') {
      fetchUsers();
    }
  }, [currentUserRole, fetchUsers]);

  const handleEditStart = (userProfile: UserProfile) => {
    setEditingUser(userProfile.user_id);
    setEditForm({
      first_name: userProfile.first_name || '',
      last_name: userProfile.last_name || '',
      department: userProfile.department || '',
    });
  };

  const handleEditSave = async (userId: string) => {
    try {
      await updateUserProfile(userId, editForm);
      setEditingUser(null);
      setEditForm({});
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleEditCancel = () => {
    setEditingUser(null);
    setEditForm({});
  };

  const handleRoleChange = async (userId: string, role: AppRole) => {
    await updateUserRole(userId, role);
  };

  const handleDeleteUser = async (userId: string) => {
    await deleteUser(userId);
  };

  if (rolesLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading user permissions...</span>
        </div>
      </div>
    );
  }

  if (currentUserRole !== 'super_admin') {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground text-center">
              You need super admin privileges to access user management.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-8 w-8" />
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <CreateUserDialog />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Super Admins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === 'super_admin').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === 'admin').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.role === 'user').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>
            Manage user accounts, edit profiles, and assign roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading users...</span>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((userProfile) => (
                  <TableRow key={userProfile.user_id}>
                    <TableCell>
                      {editingUser === userProfile.user_id ? (
                        <div className="flex gap-2">
                          <Input
                            placeholder="First name"
                            value={editForm.first_name || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                            className="w-20"
                          />
                          <Input
                            placeholder="Last name"
                            value={editForm.last_name || ''}
                            onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                            className="w-20"
                          />
                        </div>
                      ) : (
                        <div>
                          {userProfile.first_name && userProfile.last_name
                            ? `${userProfile.first_name} ${userProfile.last_name}`
                            : 'No name set'
                          }
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{userProfile.email}</TableCell>
                    <TableCell>
                      {editingUser === userProfile.user_id ? (
                        <Input
                          placeholder="Department"
                          value={editForm.department || ''}
                          onChange={(e) => setEditForm(prev => ({ ...prev, department: e.target.value }))}
                          className="w-32"
                        />
                      ) : (
                        userProfile.department || 'No department'
                      )}
                    </TableCell>
                    <TableCell>
                      <UserRoleSelect
                        currentRole={userProfile.role}
                        onRoleChange={(role) => handleRoleChange(userProfile.user_id, role)}
                        disabled={userProfile.user_id === user?.id}
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(userProfile.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {editingUser === userProfile.user_id ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditSave(userProfile.user_id)}
                            >
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleEditCancel}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditStart(userProfile)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            {userProfile.user_id !== user?.id && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete User</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this user? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteUser(userProfile.user_id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;
