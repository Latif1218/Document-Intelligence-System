import { z } from 'zod';
import { APPLICATION_ROLES, ROLES_LIST } from '../../../shared/constants/roles.js';


// Validation schema for Super Admin Onboarding (One-time only)
export const onboardSuperAdminSchema = z.object({
  body: z.object({
    username: z
      .string({ required_error: 'Username is required' })
      .min(3, { message: 'Username must be at least 3 characters long' })
      .max(50, { message: 'Username cannot exceed 50 characters' })
      .regex(/^[a-zA-Z0-9_.-]+$/, { message: 'Username can only contain alphanumeric characters, dots, and underscores' }),
    name: z.string().optional(),
    email: z
      .string({ required_error: 'Email is required' })
      .email({ message: 'A valid email address is required' }),
    password: z
      .string({ required_error: 'Password is required' })
      .min(6, { message: 'Password must be at least 6 characters long' })
      .max(128, { message: 'Password cannot exceed 128 characters' }),
  }),
});


// Validation schema for User Registration
export const registerSchema = z.object({
  body: z.object({
    username: z
      .string({ required_error: 'Username is required' })
      .min(3, { message: 'Username must be at least 3 characters long' })
      .max(50, { message: 'Username cannot exceed 50 characters' }),
    name: z.string().optional(),
    email: z
      .string({ required_error: 'Email is required' })
      .email({ message: 'A valid email address is required' }),
    password: z
      .string({ required_error: 'Password is required' })
      .min(6, { message: 'Password must be at least 6 characters long' })
      .max(128, { message: 'Password cannot exceed 128 characters' }),
    role: z.enum(ROLES_LIST).optional(),
    clientId: z.string().uuid().optional().nullable(),
  }),
});


// Validation schema for User Login (Accepts username or email)
export const loginSchema = z.object({
  body: z.object({
    username: z.string().optional(),
    email: z.string().optional(),
    password: z.string().min(1, { message: 'Password is required' }),
  }).refine((data) => data.username || data.email, {
    message: 'Either username or email is required for login',
    path: ['username'],
  }),
});


// Validation schema for Admin Updating User Role
export const updateRoleSchema = z.object({
  params: z.object({
    id: z.string().uuid({ message: 'Invalid user ID. Must be a valid UUID' }),
  }),
  body: z.object({
    role: z.enum([
      APPLICATION_ROLES.SUPER_ADMIN,
      APPLICATION_ROLES.CLIENT_ADMIN,
      APPLICATION_ROLES.CLIENT_VIEWER,
    ], {
      message: 'Invalid role. Must be super_admin, client_admin, or client_viewer',
    }),
  }),
});
