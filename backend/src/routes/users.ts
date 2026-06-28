import { Router } from 'express';
import { handleCreateUser, handleGetUser } from '../controllers/userController';

export const usersRouter = Router();

usersRouter.post('/', handleCreateUser);
usersRouter.get('/:id', handleGetUser);
