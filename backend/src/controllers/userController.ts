import type { Request, Response } from 'express';
import { createUser, getAllUsers, getUserById } from '../services/userService';
import { AppError } from '../middlewares/errorHandler';

export async function handleCreateUser(req: Request, res: Response) {
  const { email, name, initialBalance } = req.body as {
    email?: string;
    name?: string;
    initialBalance?: number;
  };

  if (!email || !name) {
    throw new AppError(400, 'email and name are required');
  }

  const user = await createUser(email, name, initialBalance ?? 0);
  res.status(201).json(user);
}

export async function handleGetUser(req: Request, res: Response) {
  const user = await getUserById(String(req.params['id']));
  if (!user) throw new AppError(404, 'User not found');
  res.json(user);
}

export async function handleGetAllUsers(_req: Request, res: Response) {
  const users = await getAllUsers();
  res.json(users);
}
