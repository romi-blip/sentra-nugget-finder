
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface UserRoleSelectProps {
  currentRole?: AppRole;
  onRoleChange: (role: AppRole) => void;
  disabled?: boolean;
}

const getRoleBadgeVariant = (role?: AppRole) => {
  switch (role) {
    case 'super_admin':
      return 'destructive';
    case 'admin':
      return 'default';
    case 'user':
      return 'secondary';
    default:
      return 'outline';
  }
};

const getRoleDisplayName = (role?: AppRole) => {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'admin':
      return 'Admin';
    case 'user':
      return 'User';
    default:
      return 'No Role';
  }
};

export const UserRoleSelect = ({ currentRole, onRoleChange, disabled }: UserRoleSelectProps) => {
  if (disabled) {
    return (
      <Badge variant={getRoleBadgeVariant(currentRole)}>
        {getRoleDisplayName(currentRole)}
      </Badge>
    );
  }

  return (
    <Select
      value={currentRole || ''}
      onValueChange={(value: AppRole) => onRoleChange(value)}
    >
      <SelectTrigger className="w-32">
        <SelectValue>
          <Badge variant={getRoleBadgeVariant(currentRole)}>
            {getRoleDisplayName(currentRole)}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="user">
          <Badge variant="secondary">User</Badge>
        </SelectItem>
        <SelectItem value="admin">
          <Badge variant="default">Admin</Badge>
        </SelectItem>
        <SelectItem value="super_admin">
          <Badge variant="destructive">Super Admin</Badge>
        </SelectItem>
      </SelectContent>
    </Select>
  );
};
