'use client';

import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, formatDateShort, cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge, categoryVariant } from './ui/Badge';
import { Skeleton } from './ui/Skeleton';
import { Button } from './ui/Button';
import { CategoryEditDialog } from './CategoryEditDialog';
import type { Transaction } from '@/types';

interface TransactionTableProps {
  accountId: string;
  userId: string;
}

interface EditState {
  transactionId: string;
  currentCategory: string | null;
}

function DirectionBadge({ isOutgoing }: { isOutgoing: boolean }) {
  return isOutgoing ? (
    <Badge variant="error">Outgoing</Badge>
  ) : (
    <Badge variant="success">Incoming</Badge>
  );
}

function ExpandedRow({
  tx,
  isOutgoing,
  accountId,
}: {
  tx: Transaction;
  isOutgoing: boolean;
  accountId: string;
}) {
  return (
    <tr className="bg-slate-50/70">
      <td colSpan={7} className="px-6 py-4 border-b border-slate-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <p className="text-slate-500 font-medium uppercase tracking-wide mb-1">
              Transaction ID
            </p>
            <p className="font-mono text-slate-700 break-all">{tx.id}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium uppercase tracking-wide mb-1">
              {isOutgoing ? 'From Account' : 'To Account'}
            </p>
            <p className="font-mono text-slate-700 break-all">{accountId}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium uppercase tracking-wide mb-1">
              {isOutgoing ? 'To Account' : 'From Account'}
            </p>
            <p className="font-mono text-slate-700 break-all">
              {isOutgoing ? tx.toAccountId : tx.fromAccountId}
            </p>
          </div>
          <div>
            <p className="text-slate-500 font-medium uppercase tracking-wide mb-1">Full Date</p>
            <p className="text-slate-700">{formatDate(tx.createdAt)}</p>
          </div>
          <div>
            <p className="text-slate-500 font-medium uppercase tracking-wide mb-1">
              Idempotency Key
            </p>
            <p className="font-mono text-slate-700 break-all">{tx.idempotencyKey}</p>
          </div>
          {tx.category && (
            <div>
              <p className="text-slate-500 font-medium uppercase tracking-wide mb-1">
                Category Source
              </p>
              <p className="text-slate-700">
                {tx.category.isUserCorrected ? (
                  <span className="text-indigo-600 font-medium">User corrected</span>
                ) : (
                  <span>AI categorized</span>
                )}
                {tx.category.isUserCorrected && (
                  <span className="text-slate-500">
                    {' '}
                    (was: {tx.category.category})
                  </span>
                )}
              </p>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100">
          {Array.from({ length: 6 }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <Skeleton className={cn('h-4', j === 0 ? 'w-16' : j === 4 ? 'w-20' : 'w-24')} />
            </td>
          ))}
          <td className="px-4 py-3">
            <Skeleton className="h-7 w-16" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function TransactionTable({ accountId, userId }: TransactionTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);

  const { data: transactions, isPending, isError, error } = useQuery({
    queryKey: ['transactions', accountId],
    queryFn: () => api.accounts.transactions(accountId),
    enabled: !!accountId,
    // Poll every 2s while any transaction is still awaiting AI categorization.
    // The callback receives live query state, so this self-cancels the moment
    // all categories are filled in — no manual cleanup needed.
    refetchInterval: (query) => {
      const data = query.state.data as Transaction[] | undefined;
      if (!data) return false;
      return data.some((tx) => tx.category === null) ? 2000 : false;
    },
  });

  const toggleExpand = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Transaction History</CardTitle>
            {transactions && (
              <span className="text-xs text-slate-500">{transactions.length} transactions</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          {isError && (
            <p className="px-6 py-4 text-sm text-red-600">
              {(error as Error).message}
            </p>
          )}

          {!isError && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Direction
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      AI Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isPending && <SkeletonRows />}

                  {transactions?.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-sm">
                        No transactions yet
                      </td>
                    </tr>
                  )}

                  {transactions?.map((tx) => {
                    const isOutgoing = tx.fromAccountId === accountId;
                    const isExpanded = expandedId === tx.id;
                    const category = tx.category?.category;
                    const displayCategory = tx.category?.correctedCategory ?? category;

                    return (
                      <Fragment key={tx.id}>
                        <tr
                          className={cn(
                            'border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer',
                            isExpanded && 'bg-slate-50/50',
                          )}
                          onClick={() => toggleExpand(tx.id)}
                        >
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <svg
                                className={cn(
                                  'w-3 h-3 text-slate-400 shrink-0 transition-transform',
                                  isExpanded && 'rotate-90',
                                )}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5l7 7-7 7"
                                />
                              </svg>
                              {formatDateShort(tx.createdAt)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <DirectionBadge isOutgoing={isOutgoing} />
                          </td>
                          <td
                            className={cn(
                              'px-4 py-3 text-right font-semibold whitespace-nowrap',
                              isOutgoing ? 'text-red-600' : 'text-emerald-600',
                            )}
                          >
                            {isOutgoing ? '−' : '+'}
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">
                            {tx.description ?? (
                              <span className="text-slate-400 italic">No description</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {displayCategory ? (
                              <div className="flex items-center gap-1.5">
                                <Badge variant={categoryVariant(displayCategory)}>
                                  {displayCategory}
                                </Badge>
                                {tx.category?.isUserCorrected && (
                                  <span
                                    title="User corrected"
                                    className="text-indigo-400 text-xs"
                                  >
                                    ✓
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-slate-400 text-xs">
                                <svg
                                  className="animate-spin h-3 w-3 shrink-0"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  />
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                  />
                                </svg>
                                Categorizing…
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={tx.status === 'COMPLETED' ? 'success' : 'error'}
                            >
                              {tx.status}
                            </Badge>
                          </td>
                          <td
                            className="px-4 py-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setEditState({
                                  transactionId: tx.id,
                                  currentCategory: displayCategory ?? null,
                                })
                              }
                            >
                              Edit Category
                            </Button>
                          </td>
                        </tr>

                        {isExpanded && (
                          <ExpandedRow
                            tx={tx}
                            isOutgoing={isOutgoing}
                            accountId={accountId}
                          />
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {editState && (
        <CategoryEditDialog
          open={true}
          onClose={() => setEditState(null)}
          transactionId={editState.transactionId}
          currentCategory={editState.currentCategory}
          accountId={accountId}
        />
      )}
    </>
  );
}
