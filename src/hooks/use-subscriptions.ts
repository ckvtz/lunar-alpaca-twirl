import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Subscription } from '@/types/subscription';

interface SubscriptionQueryOptions {
  sortBy?: 'name' | 'renewal_price' | 'next_payment_date';
  sortOrder?: 'asc' | 'desc';
  filterCategory?: string;
  filterCycle?: 'monthly' | 'quarterly' | 'annually' | 'weekly' | 'all';
}

const fetchSubscriptions = async (userId: string, options: SubscriptionQueryOptions): Promise<Subscription[]> => {
  let query = supabase
    .from('subscriptions')
    .select('*')
    .eq('created_by', userId);

  // 1. Apply Filters
  if (options.filterCategory && options.filterCategory !== 'all') {
    query = query.eq('category', options.filterCategory);
  }
  if (options.filterCycle && options.filterCycle !== 'all') {
    query = query.eq('billing_cycle', options.filterCycle);
  }

  // 2. Apply Sorting
  const sortBy = options.sortBy || 'next_payment_date';
  const ascending = options.sortOrder === 'asc';
  
  query = query.order(sortBy, { ascending });

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }
  
  // Ensure renewal_price is treated as a number
  return data.map(sub => ({
    ...sub,
    renewal_price: parseFloat(sub.renewal_price as unknown as string),
  })) as Subscription[];
};

export const useSubscriptions = (options: SubscriptionQueryOptions = {}) => {
  const { user } = useSession();
  const userId = user?.id;

  return useQuery<Subscription[], Error>({
    queryKey: ['subscriptions', userId, options],
    queryFn: () => fetchSubscriptions(userId!, options),
    enabled: !!userId, // Only run query if user ID is available
  });
};