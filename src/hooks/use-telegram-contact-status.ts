import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';

interface TelegramContact {
  contact_id: string;
}

const fetchTelegramContact = async (userId: string): Promise<TelegramContact | null> => {
  // RLS on user_contacts ensures only the user's data is returned.
  const { data, error } = await supabase
    .from('user_contacts')
    .select('contact_id')
    .eq('user_id', userId)
    .eq('provider', 'telegram')
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
    throw new Error(error.message);
  }
  
  return data ? { contact_id: data.contact_id } : null;
};

export const useTelegramContactStatus = () => {
  const { user } = useSession();
  const userId = user?.id;

  return useQuery<TelegramContact | null, Error>({
    queryKey: ['telegramContact', userId],
    queryFn: () => fetchTelegramContact(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};