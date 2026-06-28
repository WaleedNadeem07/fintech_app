import type {
  Account,
  Insights,
  Transaction,
  TransactionCategory,
  TransferResponse,
  User,
} from '@/types';

const BASE_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  users: {
    list: () => request<User[]>('/users'),
    get: (id: string) => request<User>(`/users/${id}`),
    insights: (id: string) => request<Insights>(`/users/${id}/insights`),
  },
  accounts: {
    get: (id: string) => request<Account>(`/accounts/${id}`),
    transactions: (id: string, limit = 50, offset = 0) =>
      request<Transaction[]>(
        `/accounts/${id}/transactions?limit=${limit}&offset=${offset}`,
      ),
  },
  transfers: {
    create: (data: {
      fromAccountId: string;
      toAccountId: string;
      amount: number;
      idempotencyKey: string;
      description?: string;
    }) =>
      request<TransferResponse>('/transfers', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
  transactions: {
    categorize: (id: string) =>
      request<TransactionCategory>(`/transactions/${id}/categorize`, {
        method: 'POST',
      }),
    correctCategory: (id: string, category: string) =>
      request<TransactionCategory>(`/transactions/${id}/category`, {
        method: 'PUT',
        body: JSON.stringify({ category }),
      }),
  },
};
