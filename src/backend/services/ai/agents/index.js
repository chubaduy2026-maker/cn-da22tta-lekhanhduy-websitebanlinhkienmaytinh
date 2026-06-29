/**
 * Agents Index — Đăng ký và export 5 Specialized Agents
 *
 * @module services/ai/agents/index
 */

const ProductSearchAgent = require('./ProductSearchAgent');
const RecommendationAgent = require('./RecommendationAgent');
const ComparisonAgent = require('./ComparisonAgent');
const PCBuilderAgent = require('./PCBuilderAgent');
const KnowledgeAgent = require('./KnowledgeAgent');

/**
 * Map intent → agent xử lý
 */
const INTENT_TO_AGENT = {
  // Product intents → ProductSearchAgent
  product_search: ProductSearchAgent,
  price_query: ProductSearchAgent,

  // Recommendation intents → RecommendationAgent
  recommendation: RecommendationAgent,
  advice: RecommendationAgent,

  // Comparison intents → ComparisonAgent
  compare: ComparisonAgent,

  // PC Build intents → PCBuilderAgent
  pc_build: PCBuilderAgent,
  build_pc: PCBuilderAgent,

  // Knowledge & social intents → KnowledgeAgent
  knowledge: KnowledgeAgent,
  tech_knowledge: KnowledgeAgent,
  greeting: KnowledgeAgent,
  thanks: KnowledgeAgent,
  goodbye: KnowledgeAgent,
  smalltalk: KnowledgeAgent,
  out_of_scope: KnowledgeAgent
};

/**
 * Lấy agent xử lý theo intent
 * @param {string} intent
 * @returns {Object} Agent instance
 */
function getAgentByIntent(intent = '') {
  return INTENT_TO_AGENT[intent] || KnowledgeAgent;
}

/**
 * Liệt kê tất cả agents đã đăng ký
 * @returns {Array<string>}
 */
function listAgents() {
  return [
    ProductSearchAgent.name,
    RecommendationAgent.name,
    ComparisonAgent.name,
    PCBuilderAgent.name,
    KnowledgeAgent.name
  ];
}

/**
 * Đăng ký agents vào AIRouter
 * @param {Object} router - AIRouter instance
 */
function registerAgents(router) {
  if (!router || typeof router.registerAgent !== 'function') {
    console.warn('[Agents] AIRouter không hỗ trợ registerAgent(), bỏ qua đăng ký.');
    return;
  }

  const agents = [
    { name: 'ProductSearchAgent', instance: ProductSearchAgent },
    { name: 'RecommendationAgent', instance: RecommendationAgent },
    { name: 'ComparisonAgent', instance: ComparisonAgent },
    { name: 'PCBuilderAgent', instance: PCBuilderAgent },
    { name: 'KnowledgeAgent', instance: KnowledgeAgent }
  ];

  for (const { name, instance } of agents) {
    try {
      router.registerAgent(name, instance);
      console.log(`✅ Registered agent: ${name}`);
    } catch (err) {
      console.warn(`⚠️ Failed to register agent ${name}:`, err.message);
    }
  }
}

module.exports = {
  ProductSearchAgent,
  RecommendationAgent,
  ComparisonAgent,
  PCBuilderAgent,
  KnowledgeAgent,
  getAgentByIntent,
  listAgents,
  registerAgents,
  INTENT_TO_AGENT
};
