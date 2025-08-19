import { Settings, Menu, LogOut, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRoles } from "@/hooks/useUserRoles";

const Navbar = ({ onOpenSettings }: { onOpenSettings: () => void }) => {
  const { user, signOut } = useAuth();
  const { canAccessKnowledgeBase, canManageWebhooks } = useUserRoles();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 lg:px-6">
        <div className="mr-4 hidden md:flex">
          <Link className="mr-6 flex items-center space-x-2" to="/">
            <span className="hidden font-bold sm:inline-block">
              Sentra GTM Assistant
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <div className="flex items-center space-x-2">
              {canAccessKnowledgeBase() && (
                <Link to="/kb">
                  <Button variant="ghost" size="sm">
                    Knowledge Base
                  </Button>
                </Link>
              )}
              <Link to="/chat">
                <Button variant="ghost" size="sm">
                  AI Chat
                </Button>
              </Link>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {canManageWebhooks() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenSettings}
                className="mr-2"
              >
                <Settings className="h-4 w-4" />
                <span className="sr-only">Settings</span>
              </Button>
            )}
            {user ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Sign Out</span>
              </Button>
            ) : (
              <Link to="/auth">
                <Button variant="ghost" size="sm">
                  <LogIn className="h-4 w-4" />
                  <span className="sr-only">Sign In</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;