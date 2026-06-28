'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';

interface TransferFormProps {
  accountId: string | null;
  userId: string;
  disabled?: boolean;
}

interface FormState {
  toAccountId: string;
  amount: string;
  description: string;
  idempotencyKey: string;
}

const emptyForm = (): FormState => ({
  toAccountId: '',
  amount: '',
  description: '',
  idempotencyKey: uuidv4(),
});

export function TransferForm({ accountId, userId, disabled }: TransferFormProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      api.transfers.create({
        fromAccountId: accountId!,
        toAccountId: form.toAccountId.trim(),
        amount: Math.round(parseFloat(form.amount) * 100) / 100,
        idempotencyKey: form.idempotencyKey,
        description: form.description.trim() || undefined,
      }),
    onSuccess: (data) => {
      const msg = data.duplicate
        ? 'Duplicate request — returning existing transfer.'
        : 'Transfer completed successfully.';
      setSuccessMsg(msg);
      setForm(emptyForm());

      void queryClient.invalidateQueries({ queryKey: ['user', userId] });
      void queryClient.invalidateQueries({ queryKey: ['transactions', accountId] });
    },
  });

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSuccessMsg(null);
    mutation.reset();
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg(null);
    mutation.mutate();
  };

  const amountNum = parseFloat(form.amount);
  const isValid =
    form.toAccountId.trim().length > 0 &&
    !isNaN(amountNum) &&
    amountNum > 0 &&
    form.idempotencyKey.length > 0;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Transfer Money</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Recipient Account ID"
            placeholder="Paste the recipient's account ID"
            value={form.toAccountId}
            onChange={set('toAccountId')}
            disabled={disabled || mutation.isPending}
          />

          <Input
            label="Amount (USD)"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={form.amount}
            onChange={set('amount')}
            disabled={disabled || mutation.isPending}
          />

          <Input
            label="Description (optional)"
            placeholder="e.g. Monthly rent"
            value={form.description}
            onChange={set('description')}
            disabled={disabled || mutation.isPending}
          />

          {/* Idempotency key */}
          <div className="space-y-1">
            <label className="block text-sm font-medium text-slate-700">
              Idempotency Key
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                value={form.idempotencyKey}
                onChange={(e) =>
                  setForm((f) => ({ ...f, idempotencyKey: e.target.value }))
                }
                disabled={mutation.isPending}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setForm((f) => ({ ...f, idempotencyKey: uuidv4() }))}
                disabled={mutation.isPending}
              >
                New
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              Keep the same key to safely retry a failed request
            </p>
          </div>

          {mutation.isError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {(mutation.error as Error).message}
            </div>
          )}

          {successMsg && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
              {successMsg}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            loading={mutation.isPending}
            disabled={disabled || !isValid}
          >
            Send Transfer
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
