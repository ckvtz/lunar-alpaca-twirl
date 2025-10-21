import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSubscription } from '@/hooks/use-subscription';
import EditSubscriptionForm from '@/components/EditSubscriptionForm';
import { Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const EditSubscription: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    // Should not happen if route is configured correctly, but good fallback
    return <Navigate to="/subscriptions" replace />;
  }

  const { data: subscription, isLoading, isError, error } = useSubscription(id);

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 max-w-2xl text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="mt-2 text-muted-foreground">Loading subscription details...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto py-8 max-w-2xl">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error.message || "Failed to load subscription. It might not exist or you may not have permission."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  // Type guard: Ensure subscription is defined before accessing its properties or passing it down.
  if (!subscription) {
    return <Navigate to="/subscriptions" replace />;
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Edit {subscription.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <EditSubscriptionForm initialData={subscription} />
        </CardContent>
      </Card>
    </div>
  );
};

export default EditSubscription;