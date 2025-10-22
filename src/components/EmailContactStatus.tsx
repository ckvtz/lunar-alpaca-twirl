import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, CheckCircle, AlertTriangle } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { Badge } from '@/components/ui/badge';

const EmailContactStatus: React.FC = () => {
  const { user } = useSession();
  const email = user?.email;
  const isVerified = user?.email_confirmed_at; // Supabase user object property

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Mail className="h-6 w-6 mr-2" />
          Email Notification Status
        </CardTitle>
        <CardDescription>
          Email notifications are sent to your primary account email address.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 border rounded-md">
          <p className="font-medium truncate">{email || 'N/A'}</p>
          {isVerified ? (
            <Badge className="bg-green-500 hover:bg-green-500/80">
              <CheckCircle className="h-3 w-3 mr-1" /> Verified
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertTriangle className="h-3 w-3 mr-1" /> Unverified
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          To change this email or verification status, please use the Supabase authentication settings.
        </p>
      </CardContent>
    </Card>
  );
};

export default EmailContactStatus;