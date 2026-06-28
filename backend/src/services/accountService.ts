import prisma from '../lib/prisma';

export async function getAccountById(id: string) {
  return prisma.account.findUnique({
    where: { id },
    select: { id: true, balance: true, currency: true, userId: true, updatedAt: true },
  });
}

export async function getAccountTransactions(accountId: string, limit = 50, offset = 0) {
  return prisma.transaction.findMany({
    where: {
      OR: [{ fromAccountId: accountId }, { toAccountId: accountId }],
    },
    include: {
      fromAccount: { select: { id: true, userId: true } },
      toAccount: { select: { id: true, userId: true } },
      category: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}
