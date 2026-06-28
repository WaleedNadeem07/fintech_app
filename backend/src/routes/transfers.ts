import { Router } from 'express';
import { handleCreateTransfer, handleGetTransfer } from '../controllers/transferController';

export const transfersRouter = Router();

transfersRouter.post('/', handleCreateTransfer);
transfersRouter.get('/:id', handleGetTransfer);
