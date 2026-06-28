import { Router } from 'express';
import { usersRouter } from './users';
import { accountsRouter } from './accounts';
import { transfersRouter } from './transfers';

export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.use('/users', usersRouter);
router.use('/accounts', accountsRouter);
router.use('/transfers', transfersRouter);
