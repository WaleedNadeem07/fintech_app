import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

type LockedAccount = {
  id: string;
  balance: Prisma.Decimal;
  version: number;
  userId: string;
  currency: string;
};

export type TransferInput = {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  idempotencyKey: string;
  description?: string;
};

export async function executeTransfer(input: TransferInput) {
  const { fromAccountId, toAccountId, amount, idempotencyKey, description } = input;

  if (fromAccountId === toAccountId) {
    throw new AppError(400, 'Cannot transfer to the same account');
  }
  if (amount <= 0) {
    throw new AppError(400, 'Amount must be greater than zero');
  }

  // Fast path: idempotency key already exists — return the existing transfer immediately
  const existing = await prisma.transaction.findUnique({
    where: { idempotencyKey },
    include: { category: true },
  });
  if (existing) return { transaction: existing, duplicate: true };

  try {
    const transaction = await prisma.$transaction(
      async (tx) => {
        // Lock both account rows in a consistent order (by id) to prevent deadlocks
        // when two concurrent transfers involve the same pair of accounts in opposite directions
        const locked = await tx.$queryRaw<LockedAccount[]>`
          SELECT id, balance, version, "userId", currency
          FROM "Account"
          WHERE id IN (${fromAccountId}, ${toAccountId})
          ORDER BY id
          FOR UPDATE
        `;

        if (locked.length !== 2) {
          throw new AppError(404, 'One or both accounts not found');
        }

        const fromAccount = locked.find((a) => a.id === fromAccountId)!;
        const toAccount = locked.find((a) => a.id === toAccountId)!;
        const transferAmount = new Prisma.Decimal(amount);

        if (fromAccount.balance.lessThan(transferAmount)) {
          throw new AppError(422, 'Insufficient funds');
        }

        // Debit sender — version check acts as optimistic lock safety net on top of FOR UPDATE
        const debitResult = await tx.account.updateMany({
          where: { id: fromAccountId, version: fromAccount.version },
          data: {
            balance: { decrement: transferAmount },
            version: { increment: 1 },
          },
        });
        if (debitResult.count === 0) {
          throw new AppError(409, 'Concurrent modification detected, please retry');
        }

        // Credit receiver
        await tx.account.update({
          where: { id: toAccountId },
          data: {
            balance: { increment: transferAmount },
            version: { increment: 1 },
          },
        });

        // Create the transaction record atomically — the unique constraint on
        // idempotencyKey is the final guard if two requests slipped through the fast-path check
        return tx.transaction.create({
          data: {
            fromAccountId,
            toAccountId,
            amount: transferAmount,
            description,
            idempotencyKey,
            status: 'COMPLETED',
          },
          include: { category: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );

    return { transaction, duplicate: false };
  } catch (error) {
    // Another concurrent request won the race on the unique constraint
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      const existing = await prisma.transaction.findUnique({
        where: { idempotencyKey },
        include: { category: true },
      });
      if (existing) return { transaction: existing, duplicate: true };
    }
    throw error;
  }
}

export async function getTransferById(id: string) {
  return prisma.transaction.findUnique({
    where: { id },
    include: {
      fromAccount: { select: { id: true, userId: true, currency: true } },
      toAccount: { select: { id: true, userId: true, currency: true } },
      category: true,
    },
  });
}
