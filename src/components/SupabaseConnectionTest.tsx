"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SupabaseConnectionTest: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Attempting to connect to Supabase...');

  const testConnection = async () => {
    setStatus('loading');
    setMessage('Attempting to connect to Supabase...');
    try {
      // Try to fetch the current session. This verifies the client is initialized and can communicate with the API.
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        setStatus('error');
        setMessage(`Connection failed: ${error.message}`);
        console.error('Supabase connection test error:', error);
        return;
      }

      if (session) {
        setStatus('success');
        setMessage(`Connection successful! User is currently logged in.`);
      } else {
        setStatus('success');
        setMessage(`Connection successful! No active user session found (expected if not logged in).`);
      }
    } catch (e) {
      setStatus('error');
      setMessage(`An unexpected error occurred during connection: ${e instanceof Error ? e.message : String(e)}`);
      console.error('Supabase connection test exception:', e);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  const Icon = status === 'loading' ? Loader2 : status === 'success' ? CheckCircle : XCircle;
  const variant = status === 'error' ? 'destructive' : status === 'success' ? 'default' : 'default';

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Terminal className="w-5 h-5 mr-2" />
          Supabase Connection Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert variant={variant} className={status === 'loading' ? 'animate-pulse' : ''}>
          <Icon className={`h-4 w-4 ${status === 'loading' ? 'animate-spin' : ''}`} />
          <AlertTitle>{status.toUpperCase()}</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
        <Button 
          onClick={testConnection} 
          disabled={status === 'loading'} 
          className="mt-4 w-full"
        >
          {status === 'loading' ? 'Testing...' : 'Re-test Connection'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default SupabaseConnectionTest;