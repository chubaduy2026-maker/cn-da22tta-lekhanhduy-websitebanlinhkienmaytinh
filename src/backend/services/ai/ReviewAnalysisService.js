/**
 * Review Analysis Service (NLP)
 * Phân tích sentiment, phát hiện spam cho reviews
 * 
 * @module services/ai/ReviewAnalysisService
 * @description AI Service cho NLP - Sentiment Analysis và Spam Detection
 */

const mongoose = require('mongoose');
const Review = require('../../models/Review');
const ReviewAnalysis = require('../../models/ReviewAnalysis');

class ReviewAnalysisService {
  constructor() {
    // Vietnamese sentiment lexicon (positive/negative words)
    this.positiveWords = new Set([
      // Positive adjectives
      'tốt', 'đẹp', 'tuyệt', 'tuyệt vời', 'xuất sắc', 'hoàn hảo', 'nhanh', 'mạnh',
      'rẻ', 'ổn', 'ok', 'okay', 'hay', 'thích', 'yêu', 'ưng', 'mê', 'phê',
      'chất lượng', 'bền', 'đáng tiền', 'đáng mua', 'hài lòng', 'ổn định',
      'chính hãng', 'xịn', 'chuẩn', 'mượt', 'êm', 'đỉnh', 'siêu', 'khỏe',
      // Service-related
      'nhanh', 'tận tình', 'nhiệt tình', 'chu đáo', 'chuyên nghiệp',
      // English
      'good', 'great', 'excellent', 'perfect', 'amazing', 'awesome', 'nice',
      'love', 'best', 'fantastic', 'wonderful', 'satisfied', 'happy',
      'recommend', 'worth', 'quality', 'fast', 'smooth'
    ]);

    this.negativeWords = new Set([
      // Negative adjectives
      'tệ', 'xấu', 'kém', 'dở', 'chán', 'dở tệ', 'tồi', 'lỗi', 'hỏng',
      'chậm', 'lag', 'giật', 'đơ', 'đắt', 'mắc', 'bẩn', 'rởm', 'fake',
      'thất vọng', 'không hài lòng', 'phàn nàn', 'khó chịu', 'bực', 'tức',
      'không như', 'không giống', 'không đúng', 'sai', 'nhầm', 'gian',
      // Quality issues
      'hư', 'vỡ', 'nứt', 'trầy', 'móp', 'méo', 'cũ', 'second',
      // Service issues
      'lâu', 'chậm trễ', 'trễ', 'delay', 'thái độ', 'vô trách nhiệm',
      // English
      'bad', 'poor', 'terrible', 'awful', 'worst', 'horrible', 'hate',
      'disappointed', 'disappointing', 'slow', 'broken', 'defective', 'fake',
      'scam', 'fraud', 'refund', 'return', 'problem', 'issue', 'fail'
    ]);

    this.negationWords = new Set([
      'không', 'chẳng', 'chả', 'đâu', 'chưa', 'chẳng', 'hổng', 'ko',
      'không phải', 'chẳng phải', 'not', 'no', 'never', "don't", "doesn't", "didn't"
    ]);

    this.intensifiers = new Map([
      ['rất', 1.5], ['cực', 1.8], ['siêu', 1.8], ['quá', 1.5], ['thật', 1.3],
      ['vô cùng', 2.0], ['cực kỳ', 2.0], ['hết sức', 1.8], ['vô đối', 2.0],
      ['very', 1.5], ['really', 1.5], ['extremely', 2.0], ['super', 1.8],
      ['absolutely', 2.0], ['totally', 1.8], ['completely', 1.8]
    ]);

    // Spam patterns
    this.spamPatterns = [
      /(.)\1{4,}/i,                    // Repeated characters: aaaaaaa
      /[A-Z]{10,}/,                    // All caps sequences
      /(https?:\/\/[^\s]+){2,}/gi,     // Multiple URLs
      /(\d{10,})/,                     // Phone numbers
      /zalo|telegram|fb\.com|facebook\.com/gi, // Social media links
      /liên hệ|contact|inbox|dm/gi,    // Contact solicitation
      /mua ngay|click|bấm vào/gi       // Call to action spam
    ];

    // Aspect keywords mapping
    this.aspectKeywords = {
      quality: ['chất lượng', 'quality', 'chất', 'bền', 'durable', 'build'],
      price: ['giá', 'price', 'tiền', 'cost', 'đắt', 'rẻ', 'expensive', 'cheap'],
      performance: ['hiệu năng', 'performance', 'nhanh', 'mạnh', 'mượt', 'fast', 'smooth', 'lag'],
      design: ['thiết kế', 'design', 'đẹp', 'màu', 'color', 'style', 'ngoại hình'],
      durability: ['bền', 'durable', 'tuổi thọ', 'lâu', 'lasting'],
      service: ['dịch vụ', 'service', 'hỗ trợ', 'support', 'nhân viên', 'staff'],
      shipping: ['giao hàng', 'shipping', 'delivery', 'vận chuyển', 'ship'],
      packaging: ['đóng gói', 'packaging', 'pack', 'hộp', 'box']
    };
  }

  // ==================== TEXT PREPROCESSING ====================

  /**
   * Chuẩn hóa text tiếng Việt
   */
  normalizeText(text) {
    if (!text) return '';
    
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Tokenize text
   */
  tokenize(text) {
    const normalized = this.normalizeText(text);
    return normalized.split(/\s+/).filter(t => t.length > 0);
  }

  // ==================== SENTIMENT ANALYSIS ====================

  /**
   * Rule-based sentiment analysis
   */
  analyzeRuleBasedSentiment(text) {
    const tokens = this.tokenize(text);
    let score = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    let isNegated = false;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const prevToken = i > 0 ? tokens[i - 1] : '';
      const nextToken = i < tokens.length - 1 ? tokens[i + 1] : '';

      // Check for negation
      if (this.negationWords.has(token)) {
        isNegated = true;
        continue;
      }

      // Check for intensifier
      let multiplier = 1;
      if (this.intensifiers.has(prevToken)) {
        multiplier = this.intensifiers.get(prevToken);
      }

      // Score positive words
      if (this.positiveWords.has(token)) {
        const wordScore = 1 * multiplier;
        if (isNegated) {
          score -= wordScore;
          negativeCount++;
        } else {
          score += wordScore;
          positiveCount++;
        }
        isNegated = false;
      }

      // Score negative words
      if (this.negativeWords.has(token)) {
        const wordScore = 1 * multiplier;
        if (isNegated) {
          score += wordScore * 0.5; // Negated negative is slightly positive
          positiveCount++;
        } else {
          score -= wordScore;
          negativeCount++;
        }
        isNegated = false;
      }

      // Reset negation after 2 tokens
      if (isNegated && i > 0 && !this.negationWords.has(tokens[i - 1])) {
        isNegated = false;
      }
    }

    // Normalize score to [-1, 1]
    const totalWords = positiveCount + negativeCount;
    const normalizedScore = totalWords > 0 ? score / totalWords : 0;
    const clampedScore = Math.max(-1, Math.min(1, normalizedScore));

    // Determine label
    let label;
    if (clampedScore > 0.2) {
      label = 'positive';
    } else if (clampedScore < -0.2) {
      label = 'negative';
    } else {
      label = 'neutral';
    }

    // Calculate confidence
    const confidence = totalWords > 0 
      ? Math.min(1, (positiveCount + negativeCount) / 5) * Math.abs(clampedScore)
      : 0.5;

    return {
      label,
      score: clampedScore,
      confidence: Math.max(0.3, confidence),
      probabilities: {
        positive: label === 'positive' ? 0.6 + confidence * 0.3 : 0.2 - confidence * 0.1,
        neutral: label === 'neutral' ? 0.6 + confidence * 0.3 : 0.3,
        negative: label === 'negative' ? 0.6 + confidence * 0.3 : 0.2 - confidence * 0.1
      },
      details: {
        positiveCount,
        negativeCount,
        rawScore: score
      }
    };
  }

  /**
   * Phân tích sentiment dựa trên rating
   */
  analyzeRatingBasedSentiment(rating) {
    if (rating >= 4) {
      return {
        label: 'positive',
        score: (rating - 3) / 2, // 4→0.5, 5→1
        confidence: 0.8
      };
    } else if (rating <= 2) {
      return {
        label: 'negative',
        score: (rating - 3) / 2, // 2→-0.5, 1→-1
        confidence: 0.8
      };
    } else {
      return {
        label: 'neutral',
        score: 0,
        confidence: 0.7
      };
    }
  }

  /**
   * Combined sentiment analysis
   */
  analyzeSentiment(text, rating = null) {
    const textSentiment = this.analyzeRuleBasedSentiment(text);
    
    if (rating !== null) {
      const ratingSentiment = this.analyzeRatingBasedSentiment(rating);
      
      // Weighted combination
      const textWeight = 0.6;
      const ratingWeight = 0.4;
      
      const combinedScore = textSentiment.score * textWeight + ratingSentiment.score * ratingWeight;
      
      // Check consistency
      const ratingContentConsistency = 
        (textSentiment.label === ratingSentiment.label) ? 1 :
        (textSentiment.label === 'neutral' || ratingSentiment.label === 'neutral') ? 0.7 : 0.3;

      return {
        label: combinedScore > 0.2 ? 'positive' : (combinedScore < -0.2 ? 'negative' : 'neutral'),
        score: combinedScore,
        confidence: (textSentiment.confidence + ratingSentiment.confidence) / 2,
        probabilities: textSentiment.probabilities,
        ratingContentConsistency
      };
    }

    return textSentiment;
  }

  // ==================== ASPECT-BASED SENTIMENT ====================

  /**
   * Phân tích sentiment theo aspect
   */
  analyzeAspectSentiment(text) {
    const tokens = this.tokenize(text);
    const aspects = [];

    for (const [aspect, keywords] of Object.entries(this.aspectKeywords)) {
      // Check if aspect is mentioned
      const mentionedKeywords = keywords.filter(kw => 
        tokens.some(t => t.includes(kw) || kw.includes(t))
      );

      if (mentionedKeywords.length > 0) {
        // Get context around the keyword and analyze sentiment
        const contextTokens = this.getContextTokens(tokens, mentionedKeywords);
        const sentiment = this.analyzeRuleBasedSentiment(contextTokens.join(' '));

        aspects.push({
          aspect,
          sentiment: sentiment.label,
          score: sentiment.score,
          keywords: mentionedKeywords
        });
      }
    }

    return aspects;
  }

  /**
   * Lấy context tokens xung quanh keywords
   */
  getContextTokens(tokens, keywords, contextSize = 5) {
    const contextTokens = new Set();
    
    tokens.forEach((token, index) => {
      if (keywords.some(kw => token.includes(kw) || kw.includes(token))) {
        // Add surrounding tokens
        for (let i = Math.max(0, index - contextSize); i <= Math.min(tokens.length - 1, index + contextSize); i++) {
          contextTokens.add(tokens[i]);
        }
      }
    });

    return Array.from(contextTokens);
  }

  // ==================== SPAM DETECTION ====================

  /**
   * Phát hiện spam review
   */
  detectSpam(text, reviewMetadata = {}) {
    const spamReasons = [];
    let spamScore = 0;
    const flags = {
      containsUrl: false,
      allCaps: false,
      excessiveEmoji: false,
      shortLength: false,
      copyPaste: false
    };

    // Check patterns
    this.spamPatterns.forEach((pattern, index) => {
      if (pattern.test(text)) {
        spamScore += 0.2;
        if (index === 0) spamReasons.push('suspicious_pattern');
        if (index === 1) spamReasons.push('excessive_caps');
        if (index === 2 || index === 3 || index === 4) {
          spamReasons.push('url_spam');
          flags.containsUrl = true;
        }
        if (index === 5) spamReasons.push('promotional_language');
      }
    });

    // Check for URL
    if (/https?:\/\/[^\s]+/gi.test(text)) {
      flags.containsUrl = true;
      spamScore += 0.1;
    }

    // Check for excessive caps
    const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
    if (capsRatio > 0.5 && text.length > 10) {
      flags.allCaps = true;
      spamScore += 0.1;
      if (!spamReasons.includes('excessive_caps')) {
        spamReasons.push('excessive_caps');
      }
    }

    // Check for excessive emoji
    const emojiCount = (text.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu) || []).length;
    if (emojiCount > 5) {
      flags.excessiveEmoji = true;
      spamScore += 0.1;
    }

    // Check for very short review
    if (text.length < 10) {
      flags.shortLength = true;
      spamScore += 0.1;
    }

    // Check for rating-content mismatch (if metadata provided)
    if (reviewMetadata.rating !== undefined) {
      const sentiment = this.analyzeRuleBasedSentiment(text);
      const ratingPositive = reviewMetadata.rating >= 4;
      const ratingNegative = reviewMetadata.rating <= 2;
      const textPositive = sentiment.label === 'positive';
      const textNegative = sentiment.label === 'negative';

      if ((ratingPositive && textNegative) || (ratingNegative && textPositive)) {
        spamReasons.push('rating_mismatch');
        spamScore += 0.2;
      }
    }

    // Check for offensive language (basic check)
    const offensivePatterns = /đm|dm|dcm|vl|clm|cl|fuck|shit|damn/gi;
    if (offensivePatterns.test(text)) {
      spamReasons.push('offensive_language');
      spamScore += 0.3;
    }

    // Normalize score
    spamScore = Math.min(1, spamScore);

    return {
      isSpam: spamScore >= 0.5,
      spamScore,
      spamReasons: [...new Set(spamReasons)],
      flags
    };
  }

  // ==================== TEXT ANALYSIS ====================

  /**
   * Phân tích text metrics
   */
  analyzeText(text) {
    const tokens = this.tokenize(text);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    // Extract keywords (most frequent non-stopwords)
    const wordCount = new Map();
    const stopwords = new Set(['và', 'của', 'có', 'là', 'cho', 'với', 'được', 'để', 'trong', 'này', 'các', 'một', 'những', 'không']);
    
    tokens.forEach(token => {
      if (!stopwords.has(token) && token.length > 2) {
        wordCount.set(token, (wordCount.get(token) || 0) + 1);
      }
    });

    const keywords = Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);

    return {
      wordCount: tokens.length,
      sentenceCount: sentences.length,
      avgSentenceLength: sentences.length > 0 ? tokens.length / sentences.length : 0,
      keywords,
      language: this.detectLanguage(text),
      readabilityScore: this.calculateReadability(text, tokens, sentences)
    };
  }

  /**
   * Detect language
   */
  detectLanguage(text) {
    const vietnamesePattern = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/gi;
    const vietnameseMatches = (text.match(vietnamesePattern) || []).length;
    
    return vietnameseMatches > 2 ? 'vi' : 'en';
  }

  /**
   * Calculate readability score
   */
  calculateReadability(text, tokens, sentences) {
    if (sentences.length === 0 || tokens.length === 0) return 50;

    const avgWordsPerSentence = tokens.length / sentences.length;
    const avgWordLength = tokens.join('').length / tokens.length;

    // Simple readability formula
    let score = 100 - (avgWordsPerSentence * 2) - (avgWordLength * 5);
    return Math.max(0, Math.min(100, score));
  }

  // ==================== QUALITY METRICS ====================

  /**
   * Tính quality metrics cho review
   */
  calculateQualityMetrics(text, sentiment, spamAnalysis, rating) {
    let overallScore = 50;

    // Length bonus
    const wordCount = this.tokenize(text).length;
    if (wordCount >= 20) overallScore += 15;
    else if (wordCount >= 10) overallScore += 10;
    else if (wordCount < 5) overallScore -= 10;

    // Sentiment confidence bonus
    overallScore += sentiment.confidence * 10;

    // Not spam bonus
    if (!spamAnalysis.isSpam) overallScore += 10;
    else overallScore -= 20;

    // Consistency bonus
    if (sentiment.ratingContentConsistency) {
      overallScore += sentiment.ratingContentConsistency * 10;
    }

    // Caps score
    overallScore = Math.max(0, Math.min(100, overallScore));

    return {
      overallScore,
      isHelpful: overallScore >= 60 && wordCount >= 10,
      isDetailed: wordCount >= 30,
      isAuthentic: !spamAnalysis.isSpam && spamAnalysis.spamScore < 0.3,
      ratingContentConsistency: sentiment.ratingContentConsistency || 1
    };
  }

  // ==================== MAIN ANALYSIS METHOD ====================

  /**
   * Full analysis cho một review
   */
  async analyzeReview(reviewId) {
    const review = await Review.findById(reviewId).populate('user', 'name');
    if (!review) {
      throw new Error('Review not found');
    }

    const startTime = Date.now();
    const text = review.comment || '';
    const rating = review.rating;

    // Run all analyses
    const sentiment = this.analyzeSentiment(text, rating);
    const aspectSentiments = this.analyzeAspectSentiment(text);
    const spamAnalysis = this.detectSpam(text, { rating });
    const textAnalysis = this.analyzeText(text);
    const qualityMetrics = this.calculateQualityMetrics(text, sentiment, spamAnalysis, rating);

    const processingTime = Date.now() - startTime;

    // Save analysis
    const analysis = await ReviewAnalysis.findOneAndUpdate(
      { review: reviewId },
      {
        review: reviewId,
        product: review.product,
        user: review.user._id || review.user,
        sentiment: {
          label: sentiment.label,
          score: sentiment.score,
          confidence: sentiment.confidence,
          probabilities: sentiment.probabilities
        },
        aspectSentiments,
        spamAnalysis,
        textAnalysis,
        qualityMetrics,
        processing: {
          model: 'rule-based',
          modelVersion: '1.0',
          processedAt: new Date(),
          processingTime,
          status: 'completed'
        },
        moderation: {
          needsReview: spamAnalysis.isSpam || qualityMetrics.overallScore < 30,
          reviewed: false
        }
      },
      { upsert: true, new: true }
    );

    return analysis;
  }

  /**
   * Batch analyze all reviews
   */
  async analyzeAllReviews(options = {}) {
    const { batchSize = 100, skipProcessed = true } = options;
    
    const query = skipProcessed 
      ? { _id: { $nin: await ReviewAnalysis.distinct('review') } }
      : {};
    
    const reviews = await Review.find(query).select('_id');
    let processed = 0;
    let failed = 0;

    console.log(`Analyzing ${reviews.length} reviews...`);

    for (let i = 0; i < reviews.length; i += batchSize) {
      const batch = reviews.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (review) => {
        try {
          await this.analyzeReview(review._id);
          processed++;
        } catch (err) {
          failed++;
          console.error(`Failed to analyze review ${review._id}:`, err.message);
        }
      }));

      console.log(`Processed ${processed}/${reviews.length} reviews`);
    }

    return { total: reviews.length, processed, failed };
  }

  /**
   * Get product sentiment summary
   */
  async getProductSentimentSummary(productId) {
    return ReviewAnalysis.getProductSentimentStats(productId);
  }
}

module.exports = new ReviewAnalysisService();
