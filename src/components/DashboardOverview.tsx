import React from 'react';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Calendar, Repeat, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Subscription } from '@/types/subscription';
import { formatDistanceToNow } from 'date-fns'; // Keeping date-fns for distance calculation
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useProfile } from '@/hooks/use-profile';
import { DateTime } from 'luxon';

const MetricCard: React.FC<{ title: string, value: string | number, icon: React.ReactNode }> = ({ title, value, icon }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

const UpcomingSubscriptionItem: React.FC<{ sub: Subscription, userTimezone: string }> = ({ sub, userTimezone }) => {
  // Parse the date (stored as YYYY-MM-DD, treated as UTC midnight by server) and convert to user's timezone
  const nextPaymentDate = DateTime.fromISO(sub.next_payment_date, { zone: 'utc' }).setZone(userTimezone);
  
  // Use standard Date object for formatDistanceToNow (which uses local time internally, but we pass the date object)
  // Note: formatDistanceToNow is less precise with timezones, but acceptable for "X days away"
  const daysUntil = formatDistanceToNow(nextPaymentDate.toJSDate(), { addSuffix: true });

  return (
    <Link to={`/subscriptions/${sub.id}/edit`} className="flex items-center justify-between p-3 hover:bg-accent rounded-md transition-colors">
      <div className="flex items-center space-x-3">
        {sub.logo_url ? (
          <img src={sub.logo_url} alt={sub.name} className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <DollarSign className="h-4 w-4" />
          </div>
        )}
        <div>
          <p className="font-medium">{sub.name}</p>
          <p className="text-sm text-muted-foreground">
            {sub.currency} {sub.renewal_price.toFixed(2)} ({sub.billing_cycle})
          </p>
        </div>
      </div>
      <div className="text-right">
        <Badge variant="secondary" className="mb-1">
          {nextPaymentDate.toFormat('MMM dd')}
        </Badge>
        <p className="text-xs text-muted-foreground">{daysUntil}</p>
      </div>
    </Link>
  );
};

const DashboardOverview: React.FC = () => {
  const { data, isLoading, isError } = useDashboardData();
  const { data: profile, isLoading: isLoadingProfile } = useProfile();

  if (isLoading || isLoadingProfile) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[120px]" />
        <Skeleton className="h-[120px]" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-destructive p-4 border border-destructive rounded-lg">
        Failed to load dashboard data.
      </div>
    );
  }

  const { totalMonthlySpend, upcomingSubscriptions } = data;
  const userTimezone = profile?.timezone || 'UTC';
  
  // Calculate next payment date in user's timezone for the metric card
  const nextPaymentDate = upcomingSubscriptions.length > 0 
    ? DateTime.fromISO(upcomingSubscriptions[0].next_payment_date, { zone: 'utc' }).setZone(userTimezone)
    : null;

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard 
          title="Total Monthly Spend (Est.)" 
          value={`$${totalMonthlySpend}`} 
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard 
          title="Total Subscriptions" 
          value={upcomingSubscriptions.length} 
          icon={<Repeat className="h-4 w-4 text-muted-foreground" />}
        />
        <MetricCard 
          title="Next Payment Due" 
          value={nextPaymentDate ? nextPaymentDate.toFormat('MMM dd') : 'N/A'} 
          icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming Payments</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {upcomingSubscriptions.length > 0 ? (
            <div className="divide-y">
              {upcomingSubscriptions.map(sub => (
                <UpcomingSubscriptionItem key={sub.id} sub={sub} userTimezone={userTimezone} />
              ))}
            </div>
          ) : (
            <p className="p-6 text-center text-muted-foreground">
              No upcoming payments found. You're all caught up!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardOverview;