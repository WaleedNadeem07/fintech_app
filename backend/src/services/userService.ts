import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

export async function createUser(email: string, name: string, initialBalance = 0) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new AppError(409, 'Email already in use');

  return prisma.user.create({
    data: {
      email,
      name,
      accounts: {
        create: { balance: initialBalance },
      },
    },
    include: { accounts: true },
  });
}

export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: { accounts: { select: { id: true, balance: true, currency: true } } },
  });
}

export async function getAllUsers() {
  return prisma.user.findMany({
    include: { accounts: { select: { id: true, balance: true, currency: true } } },
    orderBy: { createdAt: 'desc' },
  });
}
