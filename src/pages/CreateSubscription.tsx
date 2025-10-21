import React from 'react';
import SubscriptionForm from '@/components/SubscriptionForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CreateSubscription: React.FC = () => {
  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Add New Subscription</CardTitle>
        </CardHeader>
        <CardContent>
          <SubscriptionForm />
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateSubscription;