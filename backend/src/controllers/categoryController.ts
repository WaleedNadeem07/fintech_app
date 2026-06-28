import type { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { llmService } from '../services/llmService';
import { AppError } from '../middlewares/errorHandler';

export async function handleCategorizeTransaction(req: Request, res: Response) {
  const transactionId = String(req.params['id']);
  await llmService.categorizeTransaction(transactionId);
  const category = await prisma.transactionCategory.findUnique({
    where: { transactionId },
  });
  res.json(category);
}

export async function handleCorrectCategory(req: Request, res: Response) {
  const transactionId = String(req.params['id']);
  const { category } = req.body as { category?: string };

  if (!category) throw new AppError(400, 'category is required');

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      fromAccount: { select: { userId: true } },
      category: true,
    },
  });
  if (!transaction) throw new AppError(404, 'Transaction not found');
  if (!transaction.category) {
    throw new AppError(400, 'Transaction has not been categorized yet. Call /categorize first.');
  }

  const updated = await prisma.transactionCategory.update({
    where: { transactionId },
    data: { correctedCategory: category, isUserCorrected: true },
  });

  await prisma.categoryFeedback.create({
    data: {
      userId: transaction.fromAccount.userId,
      description: transaction.description ?? 'Money transfer',
      originalCategory: transaction.category.category,
      correctedCategory: category,
    },
  });

  res.json(updated);
}

export async function handleGetInsights(req: Request, res: Response) {
  const insights = await llmService.generateInsights(String(req.params['id']));
  res.json(insights);
}
