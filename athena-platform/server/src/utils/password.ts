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

/**
 * A valid bcrypt hash that no realistic password will ever match.
 * Used to keep login timings identical whether or not the email exists,
 * which neutralises bcrypt-timing email enumeration.
 *
 * The hash below is bcrypt-of a 32-byte random string generated once
 * at module load — fixed for the process lifetime so timings are stable.
 */
export const DUMMY_PASSWORD_HASH: string = bcrypt.hashSync(
  randomBytes(32).toString('hex'),
  SALT_ROUNDS
);
