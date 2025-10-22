import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, Search, Save, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSession } from '@/contexts/SessionContext';
import { showSuccess, showError } from '@/utils/toast';
import { Subscription } from '@/types/subscription';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCategories } from '@/hooks/use-categories';
import { Skeleton } from '@/components/ui/skeleton';

// --- Schema Definition (Updated to allow null for optional strings) ---
const SubscriptionSchema = z.object({
  name: z.string().min(2, { message: "Subscription name must be at least 2 characters." }),
  renewal_price: z.coerce.number().positive({ message: "Price must be positive." }),
  currency: z.string().min(1, { message: "Currency is required." }),
  next_payment_date: z.date({ required_error: "Next payment date is required." }),
  billing_cycle: z.enum(["monthly", "quarterly", "annually", "weekly"]),
  category: z.string().optional().nullable(), // Allow null
  logo_url: z.string().url().optional().or(z.literal('')).nullable(), // Allow null
  service_url: z.string().url().optional().or(z.literal('')).nullable(), // Allow null
  payment_method: z.string().optional().nullable(), // Allow null
  notes: z.string().optional().nullable(), // Allow null
  reminder_offset: z.enum(["none", "15m", "1h", "1d", "1w"]),
  notification_mode: z.enum(["telegram", "email"]),
});

type SubscriptionFormValues = z.infer<typeof SubscriptionSchema>;

interface EditSubscriptionFormProps {
  initialData: Subscription;
}

const EditSubscriptionForm: React.FC<EditSubscriptionFormProps> = ({ initialData }) => {
  const { user } = useSession();
  const { data: categories, isLoading: isLoadingCategories } = useCategories();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [logoSearchQuery, setLogoSearchQuery] = useState(initialData.name);
  const [logoSearchResults, setLogoSearchResults] = useState<{ name: string, logo_url: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const defaultValues: SubscriptionFormValues = {
    ...initialData,
    renewal_price: initialData.renewal_price,
    next_payment_date: parseISO(initialData.next_payment_date),
    billing_cycle: initialData.billing_cycle,
    reminder_offset: initialData.reminder_offset || 'none',
    notification_mode: initialData.notification_mode,
    category: initialData.category || null, // Ensure null is handled
    logo_url: initialData.logo_url || null,
    service_url: initialData.service_url || null,
    payment_method: initialData.payment_method || null,
    notes: initialData.notes || null,
  };

  const form = useForm<SubscriptionFormValues>({
    resolver: zodResolver(SubscriptionSchema),
    defaultValues,
  });

  const handleLogoSearch = async () => {
    if (!logoSearchQuery.trim()) {
      setLogoSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const response = await fetch('/api/action_logo_search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: logoSearchQuery }),
      });
      const data = await response.json();
      if (data.ok) {
        setLogoSearchResults(data.results);
      } else {
        showError(data.error || 'Failed to search logos.');
        setLogoSearchResults([]);
      }
    } catch (error) {
      showError('Network error during logo search.');
    } finally {
      setIsSearching(false);
    }
  };

  const onSubmit = async (values: SubscriptionFormValues) => {
    if (!user) {
      showError("You must be logged in to update a subscription.");
      return;
    }
    setIsSubmitting(true);
    
    const payload = {
      id: initialData.id,
      ...values,
      // Convert date object to ISO string for the backend
      next_payment_date: format(values.next_payment_date, 'yyyy-MM-dd'),
      renewal_price: values.renewal_price.toFixed(2),
      user_id: user.id, // Pass user ID for RLS and audit logging
      // Ensure null values are passed correctly for optional fields
      category: values.category || null,
      logo_url: values.logo_url || null,
      service_url: values.service_url || null,
      payment_method: values.payment_method || null,
      notes: values.notes || null,
    };

    try {
      const response = await fetch('/api/action_update_subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        showSuccess('Subscription updated successfully!');
        // Invalidate queries to refresh the list and the single subscription view
        queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
        queryClient.invalidateQueries({ queryKey: ['subscription', initialData.id] });
        navigate('/subscriptions');
      } else {
        showError(data.error || 'Failed to update subscription.');
      }
    } catch (error) {
      showError('Network error: Could not connect to server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!user) {
      showError("You must be logged in to delete a subscription.");
      return;
    }
    setIsDeleting(true);

    try {
      const response = await fetch('/api/action_delete_subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: initialData.id, user_id: user.id }),
      });

      const data = await response.json();

      if (response.ok && data.ok) {
        showSuccess(`Subscription '${initialData.name}' deleted successfully.`);
        // Invalidate list query
        queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
        navigate('/subscriptions');
      } else {
        showError(data.error || 'Failed to delete subscription.');
      }
    } catch (error) {
      showError('Network error: Could not connect to server.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        {/* Subscription Name & Logo Search */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Subscription Name</FormLabel>
              <FormControl>
                <div className="flex space-x-2">
                  <Input 
                    placeholder="e.g., Netflix Premium" 
                    {...field} 
                    onChange={(e) => {
                      field.onChange(e);
                      setLogoSearchQuery(e.target.value);
                    }}
                  />
                  <Button type="button" onClick={handleLogoSearch} disabled={isSearching}>
                    {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Logo Search Results */}
        {logoSearchResults.length > 0 && (
          <div className="space-y-2">
            <FormLabel>Suggested Logos</FormLabel>
            <div className="flex space-x-3 overflow-x-auto p-2 border rounded-md">
              {logoSearchResults.map((result) => (
                <div 
                  key={result.name} 
                  className="flex flex-col items-center cursor-pointer p-2 hover:bg-accent rounded-md transition-colors"
                  onClick={() => {
                    form.setValue('logo_url', result.logo_url, { shouldValidate: true });
                    showSuccess(`Logo set to ${result.name}`);
                  }}
                >
                  <img src={result.logo_url} alt={result.name} className="w-10 h-10 rounded-full object-cover" />
                  <span className="text-xs mt-1 text-center">{result.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Logo URL */}
        <FormField
          control={form.control}
          name="logo_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Logo URL (Optional)</FormLabel>
              <FormControl>
                <Input 
                  placeholder="https://example.com/logo.png" 
                  {...field} 
                  value={field.value ?? ''} // Fix: Convert null to empty string
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Service URL */}
        <FormField
          control={form.control}
          name="service_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Service URL (Optional)</FormLabel>
              <FormControl>
                <Input 
                  placeholder="https://netflix.com" 
                  {...field} 
                  value={field.value ?? ''} // Fix: Convert null to empty string
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Category Select */}
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category (Optional)</FormLabel>
              {isLoadingCategories ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {categories?.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Price, Currency, Cycle */}
        <div className="grid grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="renewal_price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" placeholder="9.99" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="currency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="billing_cycle"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cycle</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select cycle" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Next Payment Date */}
        <FormField
          control={form.control}
          name="next_payment_date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Next Payment Date</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Reminder Offset & Notification Mode */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="reminder_offset"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reminder Offset</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="When to remind" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="none">No Reminder</SelectItem>
                    <SelectItem value="15m">15 Minutes Before</SelectItem>
                    <SelectItem value="1h">1 Hour Before</SelectItem>
                    <SelectItem value="1d">1 Day Before</SelectItem>
                    <SelectItem value="1w">1 Week Before</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notification_mode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notification Mode</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select mode" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="telegram">Telegram</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Notes */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Any specific details about this subscription..." 
                  {...field} 
                  value={field.value ?? ''} // Fix: Convert null to empty string
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-between space-x-4 pt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive" disabled={isDeleting || isSubmitting}>
                {isDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <><Trash2 className="mr-2 h-4 w-4" /> Delete</>
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the subscription 
                  <span className="font-bold"> {initialData.name}</span> and all associated reminders.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button type="submit" className="flex-grow" disabled={isSubmitting || isDeleting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <><Save className="mr-2 h-4 w-4" /> Save Changes</>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default EditSubscriptionForm;