import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSession } from '@/contexts/SessionContext';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, Home, PlusCircle, Settings, Activity } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';

const Navbar: React.FC = () => {
  const { user } = useSession();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showError('Failed to sign out: ' + error.message);
    } else {
      showSuccess('Successfully signed out.');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <Home className="h-6 w-6 text-primary" />
          <span className="font-bold text-lg">SubscriptionGuard</span>
        </Link>
        
        <nav className="flex items-center space-x-4">
          {user ? (
            <>
              <Link to="/subscriptions/new">
                <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                  <PlusCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Subscription</span>
                </Button>
              </Link>
              <Link to="/monitoring">
                <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                  <Activity className="h-4 w-4" />
                  <span className="hidden sm:inline">Monitoring</span>
                </Button>
              </Link>
              <Link to="/settings/contacts">
                <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Settings</span>
                </Button>
              </Link>
              <span className="text-sm text-muted-foreground hidden lg:inline">
                {user.email}
              </span>
              <Button variant="ghost" onClick={handleSignOut} className="flex items-center space-x-2">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </>
          ) : (
            <Link to="/login">
              <Button variant="default">Sign In</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;