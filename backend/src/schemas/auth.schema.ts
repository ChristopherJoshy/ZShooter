import { z } from 'zod';

export const registerSchema = z.object({
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(24, 'Username cannot exceed 24 characters')
    .regex(/^[a-zA-Z0-9_\- ]+$/, 'Username may only contain letters, numbers, spaces, hyphens, or underscores'),
  password: z
    .string()
    .min(4, 'Password must be at least 4 characters')
    .max(72, 'Password cannot exceed 72 characters'),
});

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
