import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/contexts/SessionContext';

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  timezone: string;
  updated_at: string | null;
}

const fetchProfile = async (userId: string): Promise<Profile> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, avatar_url, timezone, updated_at')
    .eq('id', userId)
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116: No rows found (profile might not exist yet)
    throw new Error(error.message);
  }
  
  // Default to UTC if profile doesn't exist or timezone is missing
  return {
    id: userId,
    first_name: data?.first_name || null,
    last_name: data?.last_name || null,
    avatar_url: data?.avatar_url || null,
    timezone: data?.timezone || 'UTC',
    updated_at: data?.updated_at || null,
  };
};

export const useProfile = () => {
  const { user } = useSession();
  const userId = user?.id;

  return useQuery<Profile, Error>({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
};