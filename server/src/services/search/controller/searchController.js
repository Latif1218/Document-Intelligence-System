import ResponseFormatter from '../../../shared/utils/responseFormatter.js';


// SearchController
class SearchController {
  constructor(hybridSearchService) {
    this.hybridSearchService = hybridSearchService;
    this.search = this.search.bind(this);
  }


  // Executes hybrid search (FTS + vector embeddings via RRF) or keyword-only fallback
  async search(req, res, next) {
    try {
      const { q, limit, status, supplier, needs_review, clientId } = req.query;

      const filters = {};
      if (status) filters.status = status;
      if (supplier) filters.supplier = supplier;
      if (needs_review !== undefined) filters.needs_review = needs_review;

      // Multi-tenant client isolation for search
      if (req.user && req.user.role === 'super_admin') {
        if (clientId) filters.clientId = clientId;
      } else {
        const resolvedClientId = req.clientId || req.user?.clientId || req.user?.client_id;
        if (resolvedClientId) filters.clientId = resolvedClientId;
      }

      const searchOutput = await this.hybridSearchService.search({
        queryText: q,
        filters,
        limit,
      });

      return ResponseFormatter.success(
        res,
        searchOutput.results,
        'Search completed successfully',
        200,
        {
          total: searchOutput.total,
          searchMode: searchOutput.searchMode,
          limit,
        }
      );
    } catch (error) {
      next(error);
    }
  }
}

export default SearchController;

