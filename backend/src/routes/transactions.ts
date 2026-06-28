import { Router } from 'express';
import {
  handleCategorizeTransaction,
  handleCorrectCategory,
} from '../controllers/categoryController';

export const transactionsRouter = Router();

transactionsRouter.post('/:id/categorize', handleCategorizeTransaction);
transactionsRouter.put('/:id/category', handleCorrectCategory);
