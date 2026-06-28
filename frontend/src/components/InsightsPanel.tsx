'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge, categoryVariant } from './ui/Badge';
import { Skeleton } from './ui/Skeleton';

interface InsightsPanelProps {
  userId: string;
}

function TrendArrow({ changePercent }: { changePercent: string | null }) {
  if (!changePercent) return <span className="text-slate-400">—</span>;
  const isPositive = changePercent.startsWith('+');
  return (
    <span className={cn('font-semibold', isPositive ? 'text-red-500' : 'text-emerald-500')}>
      {changePercent}
    </span>
  );
}

export function InsightsPanel({ userId }: InsightsPanelProps) {
  const { data: insights, isPending, isError, error, refetch } = useQuery({
    queryKey: ['insights', userId],
    queryFn: () => api.users.insights(userId),
    enabled: !!userId,
    retry: false,
  });

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle>Spending Insights</CardTitle>
          <button
            onClick={() => void refetch()}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
            disabled={isPending}
          >
            Refresh
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-4 flex-1">
        {isPending && (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        )}

        {isError && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
            {(error as Error).message}
          </div>
        )}

        {insights?.message && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600 text-center">
            {insights.message}
          </div>
        )}

        {insights && !insights.message && (
          <div className="space-y-4">
            {/* Summary row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">
                  30-Day Spend
                </p>
                <p className="text-xl font-bold text-slate-900">
                  {formatCurrency(insights.totalSpent ?? 0)}
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">
                  vs Last Month
                </p>
                <p className="text-xl font-bold">
                  <TrendArrow changePercent={insights.monthlyTrend?.changePercent ?? null} />
                </p>
              </div>
            </div>

            {/* Largest category */}
            {insights.largestCategory && (
              <div className="flex items-center justify-between rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-3">
                <div>
                  <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide mb-0.5">
                    Largest Category
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={categoryVariant(insights.largestCategory.name)}>
                      {insights.largestCategory.name}
                    </Badge>
                  </div>
                </div>
                <p className="text-lg font-bold text-indigo-700">
                  {formatCurrency(insights.largestCategory.amount)}
                </p>
              </div>
            )}

            {/* Category breakdown */}
            {insights.categoryBreakdown && insights.categoryBreakdown.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">
                  Breakdown
                </p>
                <div className="space-y-2">
                  {insights.categoryBreakdown.map((item) => (
                    <div key={item.category}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-700 font-medium">{item.category}</span>
                        <span className="text-slate-500">
                          {formatCurrency(item.amount)}{' '}
                          <span className="text-slate-400">({item.percentage}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unusual spending */}
            {insights.unusualSpending && insights.unusualSpending.length > 0 && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
                <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-2">
                  ⚠ Unusual Spending
                </p>
                <div className="space-y-1">
                  {insights.unusualSpending.map((item) => (
                    <div key={item.category} className="flex justify-between text-sm">
                      <span className="text-amber-800">{item.category}</span>
                      <span className="font-semibold text-amber-800">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-amber-500 mt-2">
                  These categories exceeded 2× your average spend
                </p>
              </div>
            )}

            {/* Period */}
            {insights.period && (
              <p className="text-xs text-slate-400 text-center">
                {new Date(insights.period.start).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                –{' '}
                {new Date(insights.period.end).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
