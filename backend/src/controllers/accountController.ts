import type { Request, Response } from 'express';
import { getAccountById, getAccountTransactions } from '../services/accountService';
import { AppError } from '../middlewares/errorHandler';

export async function handleGetAccount(req: Request, res: Response) {
  const account = await getAccountById(String(req.params['id']));
  if (!account) throw new AppError(404, 'Account not found');
  res.json(account);
}

export async function handleGetTransactions(req: Request, res: Response) {
  const limit = Math.min(Number(req.query['limit'] as string | undefined ?? 50), 100);
  const offset = Number(req.query['offset'] as string | undefined ?? 0);
  const transactions = await getAccountTransactions(
    String(req.params['id']),
    limit,
    offset,
  );
  res.json(transactions);
}
