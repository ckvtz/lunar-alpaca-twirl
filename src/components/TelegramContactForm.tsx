import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Bot, Link, RefreshCw, Trash2 } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

const TELEGRAM_BOT_USERNAME = '@SubscriptionGuardBot'; // Placeholder

const TelegramContactForm: React.FC = () => {
  const { user } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [existingContactId, setExistingContactId] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);

  const fetchExistingContact = async () => {
    if (!user) return;
    setIsLoading(true);
    setLinkToken(null); // Clear token on refresh
    
    const { data, error } = await supabase
      .from('user_contacts')
      .select('contact_id')
      .eq('user_id', user.id)
      .eq('provider', 'telegram')
      .limit(1)
      .single();

    if (data) {
      setExistingContactId(data.contact_id);
    } else if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
      showError('Failed to load existing contact: ' + error.message);
    } else {
      setExistingContactId(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchExistingContact();
  }, [user]);

  const handleGenerateToken = async () => {
    if (!user) {
      showError("You must be logged in to generate a token.");
      return;
    }
    setIsGenerating(true);
    setLinkToken(null);

    try {
      const response = await fetch('/api/action_generate_telegram_link_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        setLinkToken(data.token);
        showSuccess('Link token generated successfully!');
      } else {
        showError(data.error || 'Failed to generate link token.');
      }
    } catch (error) {
      showError('Network error: Could not connect to server.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUnlink = async () => {
    if (!user || !existingContactId) return;
    setIsUnlinking(true);

    const { error } = await supabase
      .from('user_contacts')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'telegram');

    if (error) {
      showError('Failed to unlink contact: ' + error.message);
    } else {
      showSuccess('Telegram contact unlinked successfully.');
      setExistingContactId(null);
      setLinkToken(null);
    }
    setIsUnlinking(false);
  };

  if (isLoading) {
    return <Loader2 className="h-6 w-6 animate-spin mx-auto" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Bot className="h-6 w-6 mr-2" />
          Telegram Notification Setup
        </CardTitle>
        <CardDescription>
          Link your Telegram account to receive subscription reminders.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {existingContactId ? (
          <Alert className="bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-300">
            <Link className="h-4 w-4" />
            <AlertTitle>Linked Successfully!</AlertTitle>
            <AlertDescription>
              Your Telegram account is linked (Chat ID: {existingContactId}). You can now select Telegram as a notification mode for your subscriptions.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="default">
            <AlertTitle>Not Linked</AlertTitle>
            <AlertDescription>
              Your Telegram account is not currently linked. Generate a token below to start the process.
            </AlertDescription>
          </Alert>
        )}

        <Separator className="my-6" />

        {linkToken ? (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Linking Instructions:</h3>
            <p className="text-sm">
              1. Open Telegram and find our bot: <a href={`https://t.me/${TELEGRAM_BOT_USERNAME.substring(1)}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono">{TELEGRAM_BOT_USERNAME}</a>
            </p>
            <p className="text-sm">
              2. Send the bot the following command:
            </p>
            <div className="p-3 bg-muted rounded-md font-mono text-sm break-all">
              /link {linkToken}
            </div>
            <p className="text-sm text-muted-foreground">
              This token is valid for 1 hour. Once the bot confirms the link, refresh this page.
            </p>
            <Button variant="secondary" onClick={fetchExistingContact} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" /> Check Status / Refresh
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Button 
              onClick={handleGenerateToken} 
              className="w-full" 
              disabled={isGenerating || isUnlinking}
            >
              {isGenerating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <><Link className="mr-2 h-4 w-4" /> Generate Link Token</>
              )}
            </Button>
            {existingContactId && (
              <Button 
                onClick={handleUnlink} 
                variant="outline" 
                className="w-full text-destructive hover:bg-destructive/10"
                disabled={isUnlinking || isGenerating}
              >
                {isUnlinking ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <><Trash2 className="mr-2 h-4 w-4" /> Unlink Telegram</>
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TelegramContactForm;