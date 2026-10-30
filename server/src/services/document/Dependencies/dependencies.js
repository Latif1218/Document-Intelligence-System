import DocumentRepository from '../repository/DocumentRepository.js';
import DocumentService from '../service/documentService.js';
import DocumentController from '../controller/documentController.js';


// Document Domain Dependency Injection Container
const documentRepository = new DocumentRepository();
const documentService = new DocumentService(documentRepository);
const documentController = new DocumentController(documentService);

export {
  documentRepository,
  documentService,
  documentController,
};

export default {
  documentRepository,
  documentService,
  documentController,
};

