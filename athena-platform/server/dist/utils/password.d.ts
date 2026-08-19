export declare const hashPassword: (password: string) => Promise<string>;
export declare const comparePassword: (password: string, hash: string) => Promise<boolean>;
export declare const generateRandomToken: () => string;
/**
 * A valid bcrypt hash that no realistic password will ever match.
 * Used to keep login timings identical whether or not the email exists,
 * which neutralises bcrypt-timing email enumeration.
 *
 * The hash below is bcrypt-of a 32-byte random string generated once
 * at module load — fixed for the process lifetime so timings are stable.
 */
export declare const DUMMY_PASSWORD_HASH: string;
//# sourceMappingURL=password.d.ts.map