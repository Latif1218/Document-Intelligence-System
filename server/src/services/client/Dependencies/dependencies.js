import ClientRepository from '../repository/ClientRepository.js';
import ApiKeyRepository from '../repository/ApiKeyRepository.js';
import { userRepository, authService } from '../../auth/Dependencies/dependencies.js';
import ClientService from '../services/clientService.js';
import ClientController from '../controller/clientController.js';

// Repositories
const clientRepository = new ClientRepository();
const apiKeyRepository = new ApiKeyRepository();

// Services
const clientService = new ClientService({
  clientRepository,
  apiKeyRepository,
  userRepository,
});

// Controllers
const clientController = new ClientController(clientService, authService);

export {
  clientRepository,
  apiKeyRepository,
  clientService,
  clientController,
};

export default {
  repository: {
    clientRepository,
    apiKeyRepository,
  },
  services: {
    clientService,
    clientServices: clientService, // Alias for reference compatibility
  },
  controller: {
    clientController,
  },
  clientController,
  clientService,
};

