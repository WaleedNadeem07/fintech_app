'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent } from './ui/Card';
import { Skeleton } from './ui/Skeleton';
import { Button } from './ui/Button';
import { NavBar } from './NavBar';
import type { User } from '@/types';

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Click to copy'}
      className="inline-flex items-center gap-1.5 group"
    >
      <code className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded group-hover:bg-indigo-50 group-hover:text-indigo-700 transition-colors">
        {value.slice(0, 18)}…
      </code>
      <span className="text-slate-400 group-hover:text-indigo-500 transition-colors shrink-0">
        {copied ? (
          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </span>
    </button>
  );
}

function UserRow({ user, onOpen }: { user: User; onOpen: () => void }) {
  const account = user.accounts[0];

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
      <td className="px-5 py-4">
        <div>
          <p className="font-medium text-slate-900 text-sm">{user.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
        </div>
      </td>
      <td className="px-5 py-4">
        <CopyButton value={user.id} />
      </td>
      <td className="px-5 py-4">
        {account ? <CopyButton value={account.id} /> : <span className="text-slate-400 text-xs">—</span>}
      </td>
      <td className="px-5 py-4 text-sm font-semibold text-slate-900">
        {account ? formatCurrency(account.balance, account.currency) : '—'}
      </td>
      <td className="px-5 py-4">
        <Button size="sm" variant="outline" onClick={onOpen}>
          Open Dashboard
        </Button>
      </td>
    </tr>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100">
          {Array.from({ length: 5 }).map((_, j) => (
            <td key={j} className="px-5 py-4">
              <Skeleton className="h-5 w-28" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function AdminPanel() {
  const router = useRouter();

  const { data: users, isPending, isRefetching, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => api.users.list(),
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar
        rightSlot={
          <button
            onClick={() => router.push('/')}
            className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            ← Back
          </button>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">All Users</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Click any ID to copy it, then open their dashboard
            </p>
          </div>
          <div className="flex items-center gap-3">
            {users && (
              <span className="text-sm text-slate-500">{users.length} users</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              loading={isRefetching}
            >
              Refresh
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0 pb-2">
            {isError && (
              <p className="px-5 py-4 text-sm text-red-600">{(error as Error).message}</p>
            )}

            {!isError && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        User
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        User ID
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Account ID
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Balance
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isPending && <SkeletonRows />}

                    {users?.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-12 text-center text-slate-400 text-sm">
                          No users yet — create one via{' '}
                          <code className="bg-slate-100 px-1 py-0.5 rounded">POST /api/users</code>
                        </td>
                      </tr>
                    )}

                    {users?.map((user) => (
                      <UserRow
                        key={user.id}
                        user={user}
                        onOpen={() => router.push(`/${user.id}`)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
