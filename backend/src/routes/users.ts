import { Router } from 'express';
import { handleCreateUser, handleGetUser } from '../controllers/userController';
import { handleGetInsights } from '../controllers/categoryController';

export const usersRouter = Router();

usersRouter.post('/', handleCreateUser);
usersRouter.get('/:id', handleGetUser);
usersRouter.get('/:id/insights', handleGetInsights);
