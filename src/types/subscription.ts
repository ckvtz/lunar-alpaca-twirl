export interface Subscription {
  id: string;
  created_by: string;
  name: string;
  logo_url: string | null;
  next_payment_date: string; // ISO Date string (YYYY-MM-DD)
  billing_cycle: 'monthly' | 'quarterly' | 'annually' | 'weekly';
  renewal_price: number;
  currency: string;
  notes: string | null;
  payment_method: string | null;
  category: string | null;
  timezone: string | null;
  valid_until: string | null;
  notification_mode: 'telegram' | 'email';
  reminder_offset: 'none' | '15m' | '1h' | '1d' | '1w' | null;
  service_url: string | null;
  created_at: string;
}