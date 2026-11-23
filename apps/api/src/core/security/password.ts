import bcrypt from "bcryptjs";

/** Passwords are stored as bcrypt hashes (cost 10); the plain text never reaches the database. */
export const hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, 10);
export const verifyPassword = (plain: string, hash: string): Promise<boolean> => bcrypt.compare(plain, hash);
