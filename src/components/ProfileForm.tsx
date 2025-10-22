import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save, User } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// --- Schema Definition ---
const ProfileSchema = z.object({
  first_name: z.string().min(1, { message: "First name is required." }).optional(),
  last_name: z.string().min(1, { message: "Last name is required." }).optional(),
  avatar_url: z.string().url({ message: "Must be a valid URL." }).optional().or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof ProfileSchema>;

const ProfileForm: React.FC = () => {
  const { user } = useSession();
  const [isLoading, setIsLoading] = useState(true);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      avatar_url: '',
    },
  });

  const fetchProfile = async () => {
    if (!user) return;
    setIsLoading(true);
    
    // RLS ensures only the user's profile is returned
    const { data, error } = await supabase
      .from('profiles')
      .select('first_name, last_name, avatar_url')
      .eq('id', user.id)
      .limit(1)
      .single();

    if (data) {
      form.reset({ 
        first_name: data.first_name || '', 
        last_name: data.last_name || '', 
        avatar_url: data.avatar_url || '' 
      });
    } else if (error && error.code !== 'PGRST116') { // PGRST116: No rows found (profile might not exist yet)
      showError('Failed to load profile: ' + error.message);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const onSubmit = async (values: ProfileFormValues) => {
    if (!user) {
      showError("You must be logged in to update your profile.");
      return;
    }
    
    const profileData = {
      id: user.id,
      first_name: values.first_name || null,
      last_name: values.last_name || null,
      avatar_url: values.avatar_url || null,
      updated_at: new Date().toISOString(),
    };

    // Upsert operation: insert if ID doesn't exist, update if it does.
    const { error } = await supabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' });

    if (error) {
      showError('Failed to save profile: ' + error.message);
    } else {
      showSuccess('Profile updated successfully!');
    }
  };

  if (isLoading) {
    return <Loader2 className="h-6 w-6 animate-spin mx-auto" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <User className="h-6 w-6 mr-2" />
          User Profile
        </CardTitle>
        <CardDescription>
          Update your personal information.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="avatar_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Avatar URL (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/avatar.jpg" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <><Save className="mr-2 h-4 w-4" /> Save Profile</>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default ProfileForm;