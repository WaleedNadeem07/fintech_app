import Groq from 'groq-sdk';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

const groq = new Groq({ apiKey: process.env['GROQ_API_KEY'] });

// qwen/qwen3.6-27b: current Groq-recommended replacement for decommissioned llama3-70b-8192
const MODEL = 'qwen/qwen3.6-27b';

const VALID_CATEGORIES = [
  'Food & Dining',
  'Transport',
  'Bills',
  'Shopping',
  'Entertainment',
  'Salary',
  'Transfers',
  'Other',
] as const;

type Category = (typeof VALID_CATEGORIES)[number];

function normalizeCategory(raw: string): Category {
  // 1. Strip complete <think>...</think> blocks (closed reasoning blocks)
  // 2. Strip unclosed <think>... blocks — everything from the tag to end of string
  const stripped = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*/gi, '')
    .trim();

  console.log(`[LLM] Stripped response: "${stripped}"`);

  // Exact match on the cleaned response
  const exact = VALID_CATEGORIES.find(
    (c) => c.toLowerCase() === stripped.toLowerCase(),
  );
  if (exact) return exact;

  // Substring scan of the cleaned response (model added trailing punctuation or whitespace)
  const inStripped = VALID_CATEGORIES.find((c) =>
    stripped.toLowerCase().includes(c.toLowerCase()),
  );
  if (inStripped) return inStripped;

  // Last resort: scan the FULL raw response — the answer may be buried inside the think block
  const inRaw = VALID_CATEGORIES.find((c) =>
    raw.toLowerCase().includes(c.toLowerCase()),
  );
  return inRaw ?? 'Other';
}

class LLMService {
  async categorizeTransaction(transactionId: string): Promise<void> {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { fromAccount: { select: { userId: true } } },
    });

    if (!transaction) throw new AppError(404, 'Transaction not found');

    // Respect user corrections — never overwrite them with AI
    const existing = await prisma.transactionCategory.findUnique({
      where: { transactionId },
    });
    if (existing?.isUserCorrected) return;

    const description = transaction.description ?? 'Money transfer';
    const userId = transaction.fromAccount.userId;

    // Fetch the last 5 corrections this user made (few-shot examples)
    const feedbacks = await prisma.categoryFeedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Build the prompt — inject user corrections so the model learns their preferences
    let userPrompt = `Categorize this transaction description into exactly one of these categories: Food & Dining, Transport, Bills, Shopping, Entertainment, Salary, Transfers, Other.\n\n`;

    if (feedbacks.length > 0) {
      userPrompt += `Here are corrections this user has made previously — follow their preferences:\n`;
      feedbacks.forEach((f) => {
        userPrompt += `  - "${f.description}" → ${f.correctedCategory}\n`;
      });
      userPrompt += `\nBased on these corrections, categorize this new transaction:\n`;
    } else {
      userPrompt += `Categorize this transaction:\n`;
    }

    userPrompt += `Description: "${description}"\nAmount: ${transaction.amount.toString()}\nCategory:`;

    console.log(`[LLM] Sending categorization request — model: ${MODEL}, transactionId: ${transactionId}`);
    console.log(`[LLM] Prompt:\n${userPrompt}`);

    let category: Category = 'Other';
    try {
      const completion = await groq.chat.completions.create({
        model: MODEL,
        temperature: 0.1,
        max_tokens: 2048, // reasoning models need space for <think>...</think> before the answer
        messages: [
          {
            role: 'system',
            content:
              'You are a strict financial transaction categorizer. Return only the category name. No explanation, no punctuation, nothing else.',
          },
          { role: 'user', content: userPrompt },
        ],
      });

      const raw = completion.choices[0]?.message?.content ?? '';
      console.log(`[LLM] Raw response: "${raw}"`);
      category = normalizeCategory(raw);
      console.log(`[LLM] Normalized category: "${category}"`);
    } catch (err) {
      console.error('[LLM] Groq categorization failed, defaulting to Other:', err);
    }

    console.log(`[LLM] Saving category "${category}" for transactionId: ${transactionId}`);

    await prisma.transactionCategory.upsert({
      where: { transactionId },
      create: { transactionId, category },
      update: { category },
    });
  }

  // --- Spending Insights (pure SQL, no LLM involved) ---
  async generateInsights(userId: string) {
    const userExists = await prisma.user.findUnique({ where: { id: userId } });
    if (!userExists) throw new AppError(404, 'User not found');

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Spend per category for the last 30 days.
    // COALESCE gives user corrections priority over the original AI category.
    const spending = await prisma.$queryRaw<Array<{ category: string; total: number }>>`
      SELECT
        COALESCE(tc."correctedCategory", tc.category) AS category,
        SUM(t.amount)::float8 AS total
      FROM "Transaction" t
      JOIN "TransactionCategory" tc ON t.id = tc."transactionId"
      JOIN "Account" a ON t."fromAccountId" = a.id
      WHERE a."userId" = ${userId}
        AND t."createdAt" >= ${thirtyDaysAgo}
      GROUP BY COALESCE(tc."correctedCategory", tc.category)
      ORDER BY total DESC
    `;

    if (spending.length === 0) {
      return { message: 'No spending data for the last 30 days' };
    }

    // Total from the previous 30-day window (for trend comparison)
    const previousPeriod = await prisma.$queryRaw<Array<{ total: number }>>`
      SELECT SUM(t.amount)::float8 AS total
      FROM "Transaction" t
      JOIN "Account" a ON t."fromAccountId" = a.id
      WHERE a."userId" = ${userId}
        AND t."createdAt" >= ${sixtyDaysAgo}
        AND t."createdAt" < ${thirtyDaysAgo}
    `;

    const totalSpent = spending.reduce((sum, s) => sum + Number(s.total), 0);
    const prevTotal = Number(previousPeriod[0]?.total ?? 0);
    const trendPercent =
      prevTotal > 0
        ? ((totalSpent - prevTotal) / prevTotal) * 100
        : null;

    // Unusual spending: categories running more than 2x the per-category average
    const avgPerCategory = totalSpent / spending.length;
    const unusualSpending = spending
      .filter((s) => Number(s.total) > avgPerCategory * 2)
      .map((s) => ({ category: s.category, amount: Math.round(Number(s.total) * 100) / 100 }));

    return {
      period: { start: thirtyDaysAgo.toISOString(), end: now.toISOString() },
      totalSpent: Math.round(totalSpent * 100) / 100,
      largestCategory: {
        name: spending[0]!.category,
        amount: Math.round(Number(spending[0]!.total) * 100) / 100,
      },
      categoryBreakdown: spending.map((s) => ({
        category: s.category,
        amount: Math.round(Number(s.total) * 100) / 100,
        percentage:
          totalSpent > 0 ? Math.round((Number(s.total) / totalSpent) * 100) : 0,
      })),
      monthlyTrend: {
        currentPeriod: Math.round(totalSpent * 100) / 100,
        previousPeriod: Math.round(prevTotal * 100) / 100,
        changePercent:
          trendPercent !== null
            ? `${trendPercent > 0 ? '+' : ''}${trendPercent.toFixed(1)}%`
            : null,
      },
      unusualSpending,
    };
  }
}

// Singleton — one Groq client shared across all requests
export const llmService = new LLMService();
