'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent } from './ui/Card';
import { Skeleton } from './ui/Skeleton';
import type { User } from '@/types';

interface BalanceCardProps {
  user: User | null;
  userPending: boolean;
  accountId: string | null;
}

interface StatBoxProps {
  label: string;
  value: string;
  pending: boolean;
  accent?: string;
}

function StatBox({ label, value, pending, accent = 'text-slate-900' }: StatBoxProps) {
  return (
    <div className="bg-slate-50 rounded-xl p-4 flex-1 min-w-0">
      <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-1.5 whitespace-nowrap">
        {label}
      </p>
      {pending ? (
        <Skeleton className="h-6 w-20" />
      ) : (
        <p className={`text-lg font-bold ${accent} truncate`}>{value}</p>
      )}
    </div>
  );
}

export function BalanceCard({ user, userPending, accountId }: BalanceCardProps) {
  const account = user?.accounts[0];

  const { data: transactions, isPending: txPending } = useQuery({
    queryKey: ['transactions', accountId],
    queryFn: () => api.accounts.transactions(accountId!),
    enabled: !!accountId,
  });

  const stats = (() => {
    if (!transactions || !accountId) return null;
    let sent = 0;
    let received = 0;
    for (const tx of transactions) {
      const amt = parseFloat(tx.amount);
      if (tx.fromAccountId === accountId) sent += amt;
      else received += amt;
    }
    return { sent, received, count: transactions.length };
  })();

  const currency = account?.currency ?? 'USD';
  const statsPending = txPending || userPending;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          {/* Balance + user info */}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Current Balance
            </p>
            {userPending ? (
              <Skeleton className="h-12 w-52 mt-1" />
            ) : (
              <p className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">
                {formatCurrency(account?.balance ?? 0, currency)}
              </p>
            )}
            {userPending ? (
              <Skeleton className="h-4 w-48 mt-2.5" />
            ) : user ? (
              <p className="text-sm text-slate-500 mt-2">
                <span className="font-medium text-slate-700">{user.name}</span>
                <span className="mx-1.5 text-slate-300">·</span>
                {user.email}
              </p>
            ) : null}

            {account && (
              <p className="mt-3 text-xs font-mono text-slate-400">
                Account:{' '}
                <span className="text-slate-600 select-all">{account.id}</span>
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="flex flex-wrap sm:flex-nowrap gap-3 sm:gap-2 lg:gap-3">
            <StatBox
              label="Total Sent"
              value={stats ? formatCurrency(stats.sent, currency) : '—'}
              pending={statsPending}
              accent="text-red-600"
            />
            <StatBox
              label="Total Received"
              value={stats ? formatCurrency(stats.received, currency) : '—'}
              pending={statsPending}
              accent="text-emerald-600"
            />
            <StatBox
              label="Transactions"
              value={stats ? String(stats.count) : '—'}
              pending={statsPending}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
