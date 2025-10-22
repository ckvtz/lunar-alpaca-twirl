import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Loader2, Save, Bot } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// --- Schema Definition ---
const ContactSchema = z.object({
  telegram_chat_id: z.string().min(5, { message: "Chat ID must be at least 5 characters." }),
});

type ContactFormValues = z.infer<typeof ContactSchema>;

const TelegramContactForm: React.FC = () => {
  const { user } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [existingContactId, setExistingContactId] = useState<string | null>(null);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(ContactSchema),
    defaultValues: {
      telegram_chat_id: '',
    },
  });

  const fetchExistingContact = async () => {
    if (!user) return;
    setIsLoading(true);
    const { data, error } = await supabase
      .from('user_contacts')
      .select('contact_id')
      .eq('user_id', user.id)
      .eq('provider', 'telegram')
      .limit(1)
      .single();

    if (data) {
      setExistingContactId(data.contact_id);
      form.reset({ telegram_chat_id: data.contact_id });
    } else if (error && error.code !== 'PGRST116') { // PGRST116: No rows found
      showError('Failed to load existing contact: ' + error.message);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchExistingContact();
  }, [user]);

  const onSubmit = async (values: ContactFormValues) => {
    if (!user) {
      showError("You must be logged in to update contacts.");
      return;
    }
    
    const contactData = {
      user_id: user.id,
      provider: 'telegram',
      contact_type: 'chat_id',
      contact_id: values.telegram_chat_id,
    };

    let response;
    if (existingContactId) {
      // Update existing contact
      response = await supabase
        .from('user_contacts')
        .update(contactData)
        .eq('user_id', user.id)
        .eq('provider', 'telegram');
    } else {
      // Insert new contact
      response = await supabase
        .from('user_contacts')
        .insert([contactData]);
    }

    if (response.error) {
      showError('Failed to save contact: ' + response.error.message);
    } else {
      setExistingContactId(values.telegram_chat_id); // Update state to reflect insertion/update
      showSuccess('Telegram Chat ID saved successfully!');
    }
  };

  if (isLoading) {
    return <Loader2 className="h-6 w-6 animate-spin mx-auto" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Bot className="h-6 w-6 mr-2" />
          Telegram Notification Setup
        </CardTitle>
        <CardDescription>
          Link your Telegram Chat ID to receive subscription reminders.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm mb-4">
          1. Find our bot on Telegram: **@SubscriptionGuardBot** (Placeholder name).
        </p>
        <p className="text-sm mb-4">
          2. Send the bot any message (e.g., "Hi"). The bot will reply with your unique Chat ID.
        </p>
        <p className="text-sm mb-6">
          3. Paste the Chat ID below and click Save.
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="telegram_chat_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Telegram Chat ID</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 123456789" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <><Save className="mr-2 h-4 w-4" /> Save Chat ID</>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default TelegramContactForm;