import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save, User, Mail, Bot, ArrowRight } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useTelegramContactStatus } from '@/hooks/use-telegram-contact-status';
import { TIMEZONES } from '@/lib/timezones';

// --- Schema Definition ---
const ProfileSchema = z.object({
  first_name: z.string().min(1, { message: "First name is required." }).optional().or(z.literal('')),
  last_name: z.string().min(1, { message: "Last name is required." }).optional().or(z.literal('')),
  avatar_url: z.string().url({ message: "Must be a valid URL." }).optional().or(z.literal('')),
  timezone: z.enum(TIMEZONES as [string, ...string[]], { required_error: "Timezone is required." }),
});

type ProfileFormValues = z.infer<typeof ProfileSchema>;

const ProfileForm: React.FC = () => {
  const { user } = useSession();
  const { data: telegramContact, isLoading: isLoadingTelegram } = useTelegramContactStatus();
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      avatar_url: '',
      timezone: 'UTC',
    },
  });

  const fetchProfile = async () => {
    if (!user) return;
    setIsLoadingProfile(true);
    
    // RLS ensures only the user's profile is returned
    const { data, error } = await supabase
      .from('profiles')
      .select('first_name, last_name, avatar_url, timezone')
      .eq('id', user.id)
      .limit(1)
      .single();

    if (data) {
      form.reset({ 
        first_name: data.first_name || '', 
        last_name: data.last_name || '', 
        avatar_url: data.avatar_url || '',
        timezone: data.timezone || 'UTC',
      });
    } else if (error && error.code !== 'PGRST116') { // PGRST116: No rows found (profile might not exist yet)
      showError('Failed to load profile: ' + error.message);
    }
    setIsLoadingProfile(false);
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
      timezone: values.timezone,
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

  if (isLoadingProfile || isLoadingTelegram) {
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
          Update your personal information and notification preferences.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select your timezone" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TIMEZONES.map(tz => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
        
        <Separator className="my-6" />

        {/* Notification Status Summary */}
        <div className="space-y-4">
            <h3 className="font-semibold text-lg">Notification Status</h3>
            
            {/* Email Status */}
            <div className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Email:</span>
                </div>
                <span className="text-sm truncate max-w-[60%]">{user?.email}</span>
            </div>

            {/* Telegram Status */}
            <div className="flex items-center justify-between p-3 border rounded-md">
                <div className="flex items-center space-x-2">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Telegram:</span>
                </div>
                {telegramContact ? (
                    <Badge className="bg-green-500 hover:bg-green-500/80">Linked</Badge>
                ) : (
                    <Badge variant="destructive">Not Linked</Badge>
                )}
            </div>

            <Link to="/settings/contacts" className="block">
                <Button variant="outline" className="w-full">
                    Manage Notification Contacts <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileForm;