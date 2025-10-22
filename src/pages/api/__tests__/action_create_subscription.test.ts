import { describe, it, expect, vi, beforeEach } from 'vitest';
import handler from '../action_create_subscription';
import { supabaseServerClient } from '../supabase_server_client'; // Corrected import path
import { DateTime } from 'luxon';

// Mock the supabaseServerClient module
vi.mock('../supabase_server_client', () => {
  const mockClient = {
    from: vi.fn(() => mockClient),
    select: vi.fn(() => mockClient),
    eq: vi.fn(() => mockClient),
    limit: vi.fn(() => mockClient),
    single: vi.fn(() => mockClient),
    insert: vi.fn(() => mockClient),
    update: vi.fn(() => mockClient),
    delete: vi.fn(() => mockClient),
    // Mock the final execution function
    then: vi.fn(),
    mockResolvedValue: (data: any, error: any = null) => {
      return Promise.resolve({ data, error });
    },
    mockRejectedValue: (error: any) => {
      return Promise.reject(error);
    },
  };
  return { supabaseServerClient: mockClient };
});

// Mock Luxon's DateTime.now() for consistent testing
const MOCK_NOW = '2025-10-20T10:00:00.000Z';
vi.spyOn(DateTime, 'now').mockReturnValue(DateTime.fromISO(MOCK_NOW).toUTC() as DateTime<true>);

describe('action_create_subscription', () => {
  const mockReq = (body: any) => ({ method: 'POST', body });
  const mockRes = {
    status: vi.fn((code) => ({
      json: vi.fn((data) => ({ code, data })),
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 405 if method is not POST', async () => {
    await handler({ method: 'GET' } as any, mockRes as any);
    expect(mockRes.status).toHaveBeenCalledWith(405);
  });

  it('should return 400 if required fields are missing', async () => {
    await handler(mockReq({ name: 'Test' }), mockRes as any);
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.status.mock.results[0].value.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('Missing field next_payment_date') })
    );
  });

  it('should successfully create subscription, audit log, and notification', async () => {
    const userId = 'auth-user-123';
    const subscriptionId = 'sub-uuid-456';
    const nextPaymentDate = '2025-11-01';
    const mockSubscription = {
      id: subscriptionId,
      name: 'Test Sub',
      next_payment_date: nextPaymentDate,
      billing_cycle: 'monthly',
      renewal_price: '10.00',
      currency: 'USD',
      notification_mode: 'telegram',
      created_by: userId,
      timezone: 'America/New_York',
      reminder_offset: '1d',
    };

    // Mock 1: Get User Timezone (profiles table)
    (supabaseServerClient.from as any).mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { timezone: 'America/New_York' }, error: null }),
    });

    // Mock 2: Insert Subscription
    (supabaseServerClient.from as any).mockReturnValueOnce({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockSubscription, error: null }),
    });

    // Mock 3: Insert Audit Log
    (supabaseServerClient.from as any).mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    // Mock 4: Insert Notification
    (supabaseServerClient.from as any).mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const payload = {
      name: 'Test Sub',
      next_payment_date: nextPaymentDate,
      billing_cycle: 'monthly',
      renewal_price: 10.00,
      currency: 'USD',
      notification_mode: 'telegram',
      created_by: userId,
      reminder_offset: '1d',
    };

    await handler(mockReq(payload), mockRes as any);

    // Check response status
    expect(mockRes.status).toHaveBeenCalledWith(201);
    expect(mockRes.status.mock.results[0].value.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, subscription: mockSubscription })
    );

    // Check Subscription insertion
    expect(supabaseServerClient.from).toHaveBeenCalledWith('subscriptions');
    const subscriptionInsertCall = (supabaseServerClient.from as any).mock.calls[1][0];
    expect(subscriptionInsertCall).toBe('subscriptions');
    
    // Check Notification insertion
    expect(supabaseServerClient.from).toHaveBeenCalledWith('notifications');
    const notificationInsertCall = (supabaseServerClient.from as any).mock.calls[3][0];
    expect(notificationInsertCall).toBe('notifications');
    
    // Verify notification scheduled time (next_payment_date 2025-11-01 in NY, minus 1 day = 2025-10-31 00:00:00 NY -> 2025-10-31T04:00:00.000Z UTC)
    const notificationInsertData = (supabaseServerClient.from as any).mock.results[3].value.insert.mock.calls[0][0][0];
    expect(notificationInsertData.scheduled_at).toBe('2025-10-31T04:00:00.000Z');
  });
});