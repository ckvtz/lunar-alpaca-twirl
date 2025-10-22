import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Subscription } from '@/types/subscription';
import { DateTime } from 'luxon';

interface DashboardData {
  totalMonthlySpend: number;
  upcomingSubscriptions: Subscription[];
}

const fetchDashboardData = async (userId: string): Promise<DashboardData> => {
  // 1. Fetch all active subscriptions for the user
  const { data: subscriptionsData, error: subError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('created_by', userId);

  if (subError) {
    throw new Error(subError.message);
  }

  const subscriptions = subscriptionsData.map(sub => ({
    ...sub,
    renewal_price: parseFloat(sub.renewal_price as unknown as string),
  })) as Subscription[];

  // 2. Calculate Total Monthly Spend (Normalized)
  let totalMonthlySpend = 0;
  
  subscriptions.forEach(sub => {
    const price = sub.renewal_price;
    let monthlyFactor = 0;

    switch (sub.billing_cycle) {
      case 'weekly':
        monthlyFactor = 4; // Approx 4 weeks per month
        break;
      case 'monthly':
        monthlyFactor = 1;
        break;
      case 'quarterly':
        monthlyFactor = 1 / 3;
        break;
      case 'annually':
        monthlyFactor = 1 / 12;
        break;
    }
    // NOTE: This calculation assumes all currencies are the same (USD for simplicity in this MVP)
    totalMonthlySpend += price * monthlyFactor;
  });

  // 3. Get Upcoming Subscriptions (Next 5)
  const upcomingSubscriptions = subscriptions
    .filter(sub => DateTime.fromISO(sub.next_payment_date).toMillis() >= DateTime.now().toMillis())
    .sort((a, b) => 
      DateTime.fromISO(a.next_payment_date).toMillis() - DateTime.fromISO(b.next_payment_date).toMillis()
    )
    .slice(0, 5);


  return {
    totalMonthlySpend: parseFloat(totalMonthlySpend.toFixed(2)),
    upcomingSubscriptions,
  };
};

export const useDashboardData = () => {
  const { user } = useSession();
  const userId = user?.id;

  return useQuery<DashboardData, Error>({
    queryKey: ['dashboardData', userId],
    queryFn: () => fetchDashboardData(userId!),
    enabled: !!userId,
    refetchInterval: 60000, // Refresh every minute
  });
};