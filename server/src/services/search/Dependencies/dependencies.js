import HybridSearchService from '../service/hybridSearchService.js';
import SearchController from '../controller/searchController.js';


// Search Domain Dependency Injection Container
const hybridSearchService = new HybridSearchService();
const searchController = new SearchController(hybridSearchService);

export {
  hybridSearchService,
  searchController,
};

export default {
  hybridSearchService,
  searchController,
};

