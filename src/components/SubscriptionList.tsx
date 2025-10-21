import React from 'react';
import { useSubscriptions } from '@/hooks/use-subscriptions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Calendar, Repeat, Bell, Link as LinkIcon, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { Subscription } from '@/types/subscription';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SubscriptionCard: React.FC<{ subscription: Subscription }> = ({ subscription }) => {
  const nextPaymentDate = format(new Date(subscription.next_payment_date), 'MMM dd, yyyy');
  const serviceUrl = subscription.service_url;
  
  return (
    <Link to={`/subscriptions/${subscription.id}/edit`} className="block">
      <Card className={cn(
        "hover:shadow-lg transition-shadow duration-300 cursor-pointer",
        "relative group" // Added group class for hover effects
      )}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center space-x-3">
            {subscription.logo_url ? (
              <img 
                src={subscription.logo_url} 
                alt={subscription.name} 
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-4 w-4 mr-2" />
              </div>
            )}
            <CardTitle className="text-xl font-semibold">{subscription.name}</CardTitle>
          </div>
          <Badge variant="secondary" className="capitalize">{subscription.category || 'General'}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center text-muted-foreground">
              <DollarSign className="h-4 w-4 mr-2" />
              <span>Price:</span>
            </div>
            <span className="font-medium text-lg">
              {subscription.currency} {subscription.renewal_price.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center text-muted-foreground">
              <Calendar className="h-4 w-4 mr-2" />
              <span>Next Payment:</span>
            </div>
            <span className="font-medium">{nextPaymentDate}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center text-muted-foreground">
              <Repeat className="h-4 w-4 mr-2" />
              <span>Cycle:</span>
            </div>
            <span className="capitalize">{subscription.billing_cycle}</span>
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center text-muted-foreground">
              <Bell className="h-4 w-4 mr-2" />
              <span>Reminder:</span>
            </div>
            <span className="capitalize">
              {subscription.reminder_offset === 'none' ? 'Off' : `${subscription.reminder_offset} before`}
            </span>
          </div>

          {serviceUrl && serviceUrl.length > 0 && (
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center text-muted-foreground">
                <LinkIcon className="h-4 w-4 mr-2" />
                <span>Service Link:</span>
              </div>
              <span className="text-primary hover:underline truncate max-w-[50%]">
                {new URL(serviceUrl).hostname}
              </span>
            </div>
          )}
        </CardContent>
        {/* Optional: Add a subtle edit icon on hover */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <Edit className="h-4 w-4 text-muted-foreground" />
        </div>
      </Card>
    </Link>
  );
};

const SubscriptionList: React.FC = () => {
  const { data: subscriptions, isLoading, isError } = useSubscriptions();

  if (isLoading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (isError) {
    return <p className="text-destructive">Error loading subscriptions. Please try again.</p>;
  }

  if (!subscriptions || subscriptions.length === 0) {
    return (
      <Card className="text-center p-8">
        <CardTitle>No Subscriptions Found</CardTitle>
        <CardDescription className="mt-2">
          Start tracking your expenses by adding your first subscription.
        </CardDescription>
        <Link to="/subscriptions/new">
          <Button className="mt-4">Add Subscription</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {subscriptions.map((sub) => (
        <SubscriptionCard key={sub.id} subscription={sub} />
      ))}
    </div>
  );
};

export default SubscriptionList;