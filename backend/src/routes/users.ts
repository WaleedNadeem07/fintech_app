import { Router } from 'express';
import { handleCreateUser, handleGetAllUsers, handleGetUser } from '../controllers/userController';
import { handleGetInsights } from '../controllers/categoryController';

export const usersRouter = Router();

usersRouter.post('/', handleCreateUser);
usersRouter.get('/', handleGetAllUsers);
usersRouter.get('/:id', handleGetUser);
usersRouter.get('/:id/insights', handleGetInsights);
