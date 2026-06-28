import type { Request, Response } from 'express';
import { executeTransfer, getTransferById } from '../services/transferService';
import { AppError } from '../middlewares/errorHandler';

export async function handleCreateTransfer(req: Request, res: Response) {
  const { fromAccountId, toAccountId, amount, idempotencyKey, description } =
    req.body as {
      fromAccountId?: string;
      toAccountId?: string;
      amount?: number;
      idempotencyKey?: string;
      description?: string;
    };

  if (!fromAccountId || !toAccountId || !amount || !idempotencyKey) {
    throw new AppError(
      400,
      'fromAccountId, toAccountId, amount, and idempotencyKey are required',
    );
  }

  const { transaction, duplicate } = await executeTransfer({
    fromAccountId,
    toAccountId,
    amount,
    idempotencyKey,
    description,
  });

  // Return 200 for duplicates so clients know it was already processed
  res.status(duplicate ? 200 : 201).json({ transaction, duplicate });
}

export async function handleGetTransfer(req: Request, res: Response) {
  const transfer = await getTransferById(String(req.params['id']));
  if (!transfer) throw new AppError(404, 'Transfer not found');
  res.json(transfer);
}
