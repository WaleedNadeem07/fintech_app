'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { NavBar } from './NavBar';
import { BalanceCard } from './BalanceCard';
import { TransferForm } from './TransferForm';
import { TransactionTable } from './TransactionTable';
import { InsightsPanel } from './InsightsPanel';

interface DashboardProps {
  userId: string;
}

export function Dashboard({ userId }: DashboardProps) {
  const router = useRouter();

  const { data: user, isPending, isError, error } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => api.users.get(userId),
    retry: false,
  });

  const accountId = user?.accounts[0]?.id ?? null;

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar
        rightSlot={
          <>
            {user && (
              <span className="hidden sm:block text-sm text-slate-500">
                Welcome,{' '}
                <span className="font-medium text-slate-900">{user.name}</span>
              </span>
            )}
            <button
              onClick={() => router.push('/')}
              className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
            >
              Switch user
            </button>
          </>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* User not found error */}
        {isError && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 flex items-center gap-3">
            <svg
              className="w-5 h-5 text-red-500 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-700">
                {(error as Error).message}
              </p>
              <button
                className="text-xs text-red-600 underline mt-0.5"
                onClick={() => router.push('/')}
              >
                Try a different user ID
              </button>
            </div>
          </div>
        )}

        {/* Balance + stats */}
        <BalanceCard user={user ?? null} userPending={isPending} accountId={accountId} />

        {/* Transfer + Insights side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TransferForm
            accountId={accountId}
            userId={userId}
            disabled={!accountId || isPending}
          />
          <InsightsPanel userId={userId} />
        </div>

        {/* Transaction history */}
        {(accountId || isPending) && (
          <TransactionTable accountId={accountId ?? ''} userId={userId} />
        )}
      </main>
    </div>
  );
}
