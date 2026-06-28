'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { VALID_CATEGORIES } from '@/types';
import { Dialog } from './ui/Dialog';
import { Select } from './ui/Select';
import { Button } from './ui/Button';

interface CategoryEditDialogProps {
  open: boolean;
  onClose: () => void;
  transactionId: string;
  currentCategory: string | null;
  accountId: string;
}

export function CategoryEditDialog({
  open,
  onClose,
  transactionId,
  currentCategory,
  accountId,
}: CategoryEditDialogProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(currentCategory ?? 'Other');

  const mutation = useMutation({
    mutationFn: () => api.transactions.correctCategory(transactionId, selected),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transactions', accountId] });
      onClose();
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title="Correct Category">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Update the AI-assigned category. Your correction will be used to improve future
          categorizations.
        </p>

        <Select
          label="Category"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={mutation.isPending}
        >
          {VALID_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </Select>

        {mutation.isError && (
          <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={selected === currentCategory}
          >
            Save
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
