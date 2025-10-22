import React, { useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

const Login: React.FC = () => {
  const { user } = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Redirect authenticated users to the home page and clear URL parameters
  useEffect(() => {
    if (user) {
      // Clear any lingering Supabase auth parameters from the URL before redirecting
      if (searchParams.has('error') || searchParams.has('error_code') || searchParams.has('error_description')) {
        // Navigate without replacing history to clear the parameters
        navigate('/', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-800 shadow-lg rounded-lg">
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">
          Sign In to SubscriptionGuard
        </h2>
        <Auth
          supabaseClient={supabase}
          providers={[]}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: 'hsl(var(--primary))',
                  brandAccent: 'hsl(var(--primary-foreground))',
                },
              },
            },
          }}
          theme="light"
          view="sign_in"
          redirectTo={window.location.origin + '/'}
        />
      </div>
    </div>
  );
};

export default Login;