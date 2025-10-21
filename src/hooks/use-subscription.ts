import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';
import { Subscription } from '@/types/subscription';

const fetchSubscription = async (id: string, userId: string): Promise<Subscription> => {
  // RLS on the 'subscriptions' table ensures the user can only fetch their own data.
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', id)
    .eq('created_by', userId) // Explicitly filter by user ID for clarity and safety
    .single();

  if (error) {
    // PGRST116 is the code for "No rows found". If the user tries to access a non-existent or non-owned subscription.
    if (error.code === 'PGRST116') {
        throw new Error('Subscription not found or unauthorized.');
    }
    throw new Error(error.message);
  }
  
  if (!data) {
    throw new Error('Subscription data is empty.');
  }

  // Ensure renewal_price is treated as a number
  return {
    ...data,
    renewal_price: parseFloat(data.renewal_price as unknown as string),
  } as Subscription;
};

export const useSubscription = (id: string | undefined) => {
  const { user } = useSession();
  const userId = user?.id;

  return useQuery<Subscription, Error>({
    queryKey: ['subscription', id],
    queryFn: () => fetchSubscription(id!, userId!),
    enabled: !!id && !!userId, // Only run query if ID and user ID are available
  });
};