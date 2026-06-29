/**
 * MetricsCalculator.js
 * TechStore AI Evaluation - Metric Algorithms
 * =============================================
 * Implements 4 core RAG evaluation metrics:
 *   1. Retrieval Accuracy  (Jaccard keyword overlap)
 *   2. Answer Correctness  (Token F1 Score)
 *   3. Faithfulness        (Grounding / Hallucination detection)
 *   4. Latency             (Response time in seconds)
 */

class MetricsCalculator {

  // ─────────────────────────────────────────────────────────────
  // 1. RETRIEVAL ACCURACY
  //    Measures whether the retrieved products are relevant
  //    to the question's expected product categories.
  //
  //    Score = |retrieved ∩ expected| / |retrieved ∪ expected|
  //            (Jaccard similarity on category keywords)
  // ─────────────────────────────────────────────────────────────
  calculateRetrievalAccuracy(retrievedProducts, expectedCategories) {
    // If no categories expected, question is category-agnostic
    if (!expectedCategories || expectedCategories.length === 0) {
      return { score: 1.0, reason: 'No specific category required' };
    }

    // If no products retrieved
    if (!retrievedProducts || retrievedProducts.length === 0) {
      return { score: 0.0, reason: 'No products retrieved' };
    }

    // Build a flat set of keywords from retrieved products
    const retrievedKeywords = new Set();
    retrievedProducts.forEach(product => {
      if (product.name)     this._tokenize(product.name.toLowerCase()).forEach(t => retrievedKeywords.add(t));
      if (product.category) this._tokenize(product.category.toLowerCase()).forEach(t => retrievedKeywords.add(t));
      if (product.brand)    retrievedKeywords.add(product.brand.toLowerCase());
    });

    // Build expected keyword set from category list
    const expectedKeywords = new Set();
    expectedCategories.forEach(cat => {
      this._tokenize(cat.toLowerCase()).forEach(t => expectedKeywords.add(t));
    });

    // Jaccard similarity
    const intersection = new Set([...retrievedKeywords].filter(k => expectedKeywords.has(k)));
    const union = new Set([...retrievedKeywords, ...expectedKeywords]);

    const score = union.size === 0 ? 0 : intersection.size / union.size;

    // Clamp to useful range: if ≥1 relevant product found, award partial credit
    const hasAnyMatch = intersection.size > 0;
    const finalScore = hasAnyMatch ? Math.max(score, 0.5) : score;

    return {
      score: Math.min(1.0, finalScore),
      retrievedCount: retrievedProducts.length,
      matchedKeywords: [...intersection],
      reason: hasAnyMatch
        ? `Found ${intersection.size} matching keywords`
        : 'No matching product categories'
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 2. ANSWER CORRECTNESS
  //    Token-level F1 Score between chatbot answer and ground truth.
  //    Precision = correct_tokens / answer_tokens
  //    Recall    = correct_tokens / truth_tokens
  //    F1        = 2 * (P * R) / (P + R)
  // ─────────────────────────────────────────────────────────────
  calculateAnswerCorrectness(chatbotAnswer, groundTruthAnswer, expectedKeywords = []) {
    if (!chatbotAnswer || !groundTruthAnswer) {
      return { score: 0.0, reason: 'Missing answer or ground truth' };
    }

    const answerTokens = this._tokenize(chatbotAnswer.toLowerCase());
    const truthTokens  = this._tokenize(groundTruthAnswer.toLowerCase());

    const answerSet = new Set(answerTokens);
    const truthSet  = new Set(truthTokens);

    const common = new Set([...answerSet].filter(t => truthSet.has(t)));

    const precision = answerSet.size > 0 ? common.size / answerSet.size : 0;
    const recall    = truthSet.size  > 0 ? common.size / truthSet.size  : 0;
    const f1 = (precision + recall) > 0
      ? (2 * precision * recall) / (precision + recall)
      : 0;

    // Bonus: check required keywords coverage
    let keywordBonus = 0;
    if (expectedKeywords && expectedKeywords.length > 0) {
      const foundKeywords = expectedKeywords.filter(kw =>
        chatbotAnswer.toLowerCase().includes(kw.toLowerCase())
      );
      keywordBonus = (foundKeywords.length / expectedKeywords.length) * 0.2;
    }

    const finalScore = Math.min(1.0, f1 * 0.8 + keywordBonus);

    return {
      score: parseFloat(finalScore.toFixed(4)),
      precision: parseFloat(precision.toFixed(4)),
      recall: parseFloat(recall.toFixed(4)),
      f1: parseFloat(f1.toFixed(4)),
      reason: `Precision: ${(precision*100).toFixed(1)}%, Recall: ${(recall*100).toFixed(1)}%`
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 3. FAITHFULNESS
  //    Detects hallucination: checks if key claims in the chatbot
  //    answer are supported by the retrieved context.
  //
  //    Score = grounded_keywords / total_answer_keywords
  // ─────────────────────────────────────────────────────────────
  calculateFaithfulness(chatbotAnswer, retrievedProducts) {
    if (!chatbotAnswer) {
      return { score: 0.0, reason: 'No answer provided' };
    }

    // If no context was retrieved, we cannot verify grounding
    if (!retrievedProducts || retrievedProducts.length === 0) {
      // Check if answer admits it doesn't know
      const uncertainPhrases = ['không tìm thấy', 'không có thông tin', 'xin lỗi', 'không thể'];
      const isHonest = uncertainPhrases.some(p => chatbotAnswer.toLowerCase().includes(p));
      return {
        score: isHonest ? 0.8 : 0.5,
        reason: isHonest
          ? 'No context, but answer appropriately acknowledges uncertainty'
          : 'No retrieved context to verify against'
      };
    }

    // Build a corpus of all context text from retrieved products
    const contextText = retrievedProducts.map(p => [
      p.name || '',
      p.brand || '',
      p.category || '',
      p.description || '',
      JSON.stringify(p.specifications || {})
    ].join(' ')).join(' ').toLowerCase();

    const contextTokens = new Set(this._tokenize(contextText));

    // Get meaningful tokens from answer (nouns/tech terms, skip stopwords)
    const answerTokens = this._tokenize(chatbotAnswer.toLowerCase())
      .filter(t => !this._isStopWord(t) && t.length > 2);

    if (answerTokens.length === 0) {
      return { score: 0.5, reason: 'Answer has no meaningful tokens to verify' };
    }

    const groundedTokens = answerTokens.filter(t => contextTokens.has(t));
    const score = groundedTokens.length / answerTokens.length;

    return {
      score: parseFloat(Math.min(1.0, score).toFixed(4)),
      groundedCount: groundedTokens.length,
      totalChecked: answerTokens.length,
      reason: `${groundedTokens.length}/${answerTokens.length} answer tokens grounded in context`
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 4. LATENCY
  //    Simple measurement: returns the elapsed time in seconds.
  //    Scoring: 1.0 = fast (<1s), 0.0 = very slow (>10s)
  // ─────────────────────────────────────────────────────────────
  calculateLatency(latencyMs) {
    const seconds = latencyMs / 1000;

    // Scoring function: linear decay from 1s (score=1.0) to 10s (score=0.0)
    let score;
    if (seconds <= 1.0)       score = 1.0;
    else if (seconds >= 10.0) score = 0.0;
    else                      score = 1.0 - (seconds - 1.0) / 9.0;

    return {
      score: parseFloat(score.toFixed(4)),
      latencyMs,
      latencySeconds: parseFloat(seconds.toFixed(3)),
      rating: seconds <= 2 ? 'Fast' : seconds <= 5 ? 'Acceptable' : 'Slow'
    };
  }

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────

  /**
   * Simple word tokenizer (splits on whitespace and punctuation)
   */
  _tokenize(text) {
    return text
      .replace(/[.,!?;:()\[\]{}"'`\/\\|<>@#%^&*+=~]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0);
  }

  /**
   * Basic Vietnamese + English stopwords
   */
  _isStopWord(word) {
    const stopwords = new Set([
      // Vietnamese
      'là','và','của','cho','trong','với','từ','này','đó','có','được','các',
      'một','những','không','đến','tại','khi','để','về','hay','hoặc','nhưng',
      'nên','cần','tốt','hơn','cũng','bạn','tôi','mình','nếu','thì','như',
      'rất','hơn','đã','sẽ','đang','vẫn','nào','còn','thêm','đây','khoảng',
      // English
      'the','a','an','is','are','was','were','be','been','have','has','had',
      'do','does','did','will','would','could','should','may','might','can',
      'i','you','he','she','we','they','it','this','that','these','those',
      'in','on','at','to','for','of','with','by','from','as','or','and','but'
    ]);
    return stopwords.has(word);
  }
}

module.exports = new MetricsCalculator();
