export interface Account {
  id: string;
  balance: string;
  currency: string;
  userId: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  accounts: Account[];
}

export interface TransactionCategory {
  transactionId: string;
  category: string;
  isUserCorrected: boolean;
  correctedCategory: string | null;
}

export interface Transaction {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  description: string | null;
  status: 'COMPLETED' | 'FAILED';
  idempotencyKey: string;
  createdAt: string;
  fromAccount: { id: string; userId: string };
  toAccount: { id: string; userId: string };
  category: TransactionCategory | null;
}

export interface TransferResponse {
  transaction: Transaction;
  duplicate: boolean;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

export interface Insights {
  period?: { start: string; end: string };
  totalSpent?: number;
  largestCategory?: { name: string; amount: number };
  categoryBreakdown?: CategoryBreakdown[];
  monthlyTrend?: {
    currentPeriod: number;
    previousPeriod: number;
    changePercent: string | null;
  };
  unusualSpending?: Array<{ category: string; amount: number }>;
  message?: string;
}

export const VALID_CATEGORIES = [
  'Food & Dining',
  'Transport',
  'Bills',
  'Shopping',
  'Entertainment',
  'Salary',
  'Transfers',
  'Other',
] as const;

export type Category = (typeof VALID_CATEGORIES)[number];
