import { Router } from 'express';
import { clientController } from '../Dependencies/dependencies.js';
import authenticate from '../../../shared/middlewares/authenticate.js';

const router = Router();


router.use(authenticate);


router.get('/', clientController.listClients);
router.get('/admin/clients', clientController.listClients);


router.post('/onboard', clientController.createClient);
router.post('/admin/clients/onboard', clientController.createClient);


router.post('/:clientId/users', clientController.createClientUser);
router.post('/admin/clients/:clientId/users', clientController.createClientUser);


router.post('/:clientId/api/keys', clientController.createApiKey);
router.post('/admin/clients/:clientId/api/keys', clientController.createApiKey);


router.get('/:clientId/api/keys', clientController.getClientApiKeys);
router.get('/admin/clients/:clientId/api/keys', clientController.getClientApiKeys);

export default router;

