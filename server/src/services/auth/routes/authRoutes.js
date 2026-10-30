import { Router } from 'express';
import { authController } from '../Dependencies/dependencies.js';
import validate from '../../../shared/middlewares/validate.js';
import authenticate from '../../../shared/middlewares/authenticate.js';
import authorize from '../../../shared/middlewares/authorize.js';
import { APPLICATION_ROLES } from '../../../shared/constants/roles.js';
import {
  onboardSuperAdminSchema,
  registerSchema,
  loginSchema,
  updateRoleSchema,
} from '../validation/authSchema.js';

const router = Router();

router.post(
  '/onboard-super-admin',
  validate(onboardSuperAdminSchema),
  authController.onboardSuperAdmin
);

router.post('/register', validate(registerSchema), authController.register);

router.post('/login', validate(loginSchema), authController.login);

router.post('/logout', authController.logout);

router.get('/me', authenticate, authController.getMe);


router.get(
  '/users',
  authenticate,
  authorize(APPLICATION_ROLES.SUPER_ADMIN, APPLICATION_ROLES.CLIENT_ADMIN),
  authController.listUsers
);

router.patch(
  '/users/:id/role',
  authenticate,
  authorize(APPLICATION_ROLES.SUPER_ADMIN),
  validate(updateRoleSchema),
  authController.updateRole
);

export default router;
