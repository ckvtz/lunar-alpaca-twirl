import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Subscription } from '@/types/subscription';

const fetchSubscriptions = async (userId: string): Promise<Subscription[]> => {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('created_by', userId)
    .order('next_payment_date', { ascending: true });

  if (error) {
    throw new Error(error.message);
  }
  
  // Ensure renewal_price is treated as a number
  return data.map(sub => ({
    ...sub,
    renewal_price: parseFloat(sub.renewal_price as unknown as string),
  })) as Subscription[];
};

export const useSubscriptions = () => {
  const { user } = useSession();
  const userId = user?.id;

  return useQuery<Subscription[], Error>({
    queryKey: ['subscriptions', userId],
    queryFn: () => fetchSubscriptions(userId!),
    enabled: !!userId, // Only run query if user ID is available
  });
};