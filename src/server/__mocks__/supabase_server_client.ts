import { vi } from 'vitest';

// Mock the entire module
export const supabaseServerClient = {
  from: vi.fn(() => supabaseServerClient),
  select: vi.fn(() => supabaseServerClient),
  eq: vi.fn(() => supabaseServerClient),
  limit: vi.fn(() => supabaseServerClient),
  single: vi.fn(() => supabaseServerClient),
  insert: vi.fn(() => supabaseServerClient),
  update: vi.fn(() => supabaseServerClient),
  delete: vi.fn(() => supabaseServerClient),
  upsert: vi.fn(() => supabaseServerClient),
  rpc: vi.fn(() => supabaseServerClient),
  order: vi.fn(() => supabaseServerClient),
  lte: vi.fn(() => supabaseServerClient),
  // Mock the final execution function
  then: vi.fn(),
  // Mock the return structure for data/error
  mockResolvedValue: (data: any, error: any = null) => {
    return Promise.resolve({ data, error });
  },
  mockRejectedValue: (error: any) => {
    return Promise.reject(error);
  },
};

// Utility to reset all mocks before each test
export const resetMocks = () => {
  for (const key in supabaseServerClient) {
    if (typeof (supabaseServerClient as any)[key] === 'function') {
      (supabaseServerClient as any)[key].mockClear();
    }
  }
};