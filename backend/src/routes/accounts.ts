import { Router } from 'express';
import { handleGetAccount, handleGetTransactions } from '../controllers/accountController';

export const accountsRouter = Router();

accountsRouter.get('/:id', handleGetAccount);
accountsRouter.get('/:id/transactions', handleGetTransactions);
