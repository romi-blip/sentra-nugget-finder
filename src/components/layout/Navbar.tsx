import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRoles } from '@/hooks/useUserRoles';
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Settings, LogOut } from 'lucide-react';

interface NavbarProps {
  onOpenSettings: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onOpenSettings }) => {
  const { user, signOut } = useAuth();
  const { hasRole, canAccessKnowledgeBase, canManageWebhooks, currentUserRole } = useUserRoles();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link to="/" className="text-xl font-bold">
              Sentra
            </Link>
            {user && (
              <div className="flex items-center space-x-4">
                <Link 
                  to="/chat" 
                  className="text-sm font-medium transition-colors hover:text-primary"
                >
                  Chat
                </Link>
                {(hasRole('admin') || hasRole('super_admin')) && (
                  <Link 
                    to="/events" 
                    className="text-sm font-medium transition-colors hover:text-primary"
                  >
                    List Management
                  </Link>
                )}
                {canAccessKnowledgeBase() && (
                  <Link 
                    to="/kb" 
                    className="text-sm font-medium transition-colors hover:text-primary"
                  >
                    Knowledge Base
                  </Link>
                )}
                {hasRole('super_admin') && (
                  <>
                    <Link 
                      to="/admin/users" 
                      className="text-sm font-medium transition-colors hover:text-primary"
                    >
                      User Management
                    </Link>
                    <Link 
                      to="/admin/settings" 
                      className="text-sm font-medium transition-colors hover:text-primary"
                    >
                      Settings
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src="" alt={user.email} />
                        <AvatarFallback>
                          {user.email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.email}</p>
                        {currentUserRole && (
                          <p className="text-xs leading-none text-muted-foreground">
                            Role: {currentUserRole.replace('_', ' ')}
                          </p>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {canManageWebhooks() && (
                      <>
                        <DropdownMenuItem onClick={() => onOpenSettings()}>
                          <Settings className="mr-2 h-4 w-4" />
                          <span>Settings</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Sign out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Link to="/auth">
                <Button>Sign In</Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
