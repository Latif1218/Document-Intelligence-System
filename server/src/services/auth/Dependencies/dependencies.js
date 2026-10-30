import UserRepository from '../repository/UserRepository.js';
import AuthService from '../service/authService.js';
import AuthController from '../controller/authController.js';

/**
 * Dependency Injection container for the Auth domain.
 * Decouples controllers and services for modularity and testing.
 */
const userRepository = new UserRepository();
const authService = new AuthService(userRepository);
const authController = new AuthController(authService);

export {
  userRepository,
  authService,
  authController,
};

export default {
  userRepository,
  authService,
  authController,
};

