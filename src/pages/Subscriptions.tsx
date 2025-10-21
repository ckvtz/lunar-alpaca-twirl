import React from 'react';
import SubscriptionList from '@/components/SubscriptionList';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { PlusCircle } from 'lucide-react';

const Subscriptions: React.FC = () => {
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Subscriptions</h1>
        <Link to="/subscriptions/new">
          <Button>
            <PlusCircle className="h-4 w-4 mr-2" />
            Add New
          </Button>
        </Link>
      </div>
      
      <SubscriptionList />
    </div>
  );
};

export default Subscriptions;