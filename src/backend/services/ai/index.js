/**
 * AI Index - Export all AI services
 * 
 * @module services/ai
 * @description Central export point for all AI services
 */

const RecommendationService = require('./RecommendationService');
const SemanticSearchService = require('./SemanticSearchService');
const ReviewAnalysisService = require('./ReviewAnalysisService');
const UserPreferenceService = require('./UserPreferenceService');
const ProductRankingService = require('./ProductRankingService');
const BehaviorTrackerService = require('./BehaviorTrackerService');

module.exports = {
  RecommendationService,
  SemanticSearchService,
  ReviewAnalysisService,
  UserPreferenceService,
  ProductRankingService,
  BehaviorTrackerService
};
