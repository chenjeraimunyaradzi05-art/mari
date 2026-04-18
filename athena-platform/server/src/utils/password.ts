import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';

const SALT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const generateRandomToken = (): string => {
  return randomBytes(32).toString('hex');
};
