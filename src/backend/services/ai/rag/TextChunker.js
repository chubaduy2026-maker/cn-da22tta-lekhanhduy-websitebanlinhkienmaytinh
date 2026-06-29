/**
 * Text Chunker
 * Splits documents into overlapping chunks for embedding
 * 
 * @module services/ai/rag/TextChunker
 */

class TextChunker {
  /**
   * Split text into overlapping chunks
   * @param {string} text - Full document text
   * @param {Object} options - Chunking options
   * @param {number} options.chunkSize - Max characters per chunk (default: 1000)
   * @param {number} options.overlap - Overlap characters between chunks (default: 150)
   * @returns {string[]} Array of text chunks
   */
  static chunk(text, options = {}) {
    const { chunkSize = 1000, overlap = 150 } = options;
    if (!text || !text.trim()) return [];

    const cleaned = TextChunker.cleanText(text);
    if (cleaned.length <= chunkSize) return [cleaned];

    const chunks = [];
    const sentences = TextChunker.splitSentences(cleaned);

    let currentChunk = '';
    let overlapBuffer = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        // Keep last portion as overlap for context continuity
        const words = currentChunk.split(/\s+/);
        const overlapWords = [];
        let len = 0;
        for (let i = words.length - 1; i >= 0 && len < overlap; i--) {
          overlapWords.unshift(words[i]);
          len += words[i].length + 1;
        }
        overlapBuffer = overlapWords.join(' ');
        currentChunk = overlapBuffer + ' ' + sentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Split text into sentences (supports Vietnamese and English)
   * @param {string} text
   * @returns {string[]}
   */
  static splitSentences(text) {
    // Split on sentence-ending punctuation followed by space or newline
    const raw = text.split(/(?<=[.!?。])\s+|\n{2,}/);
    return raw.map(s => s.trim()).filter(s => s.length > 10);
  }

  /**
   * Clean and normalize text
   * @param {string} text
   * @returns {string}
   */
  static cleanText(text) {
    return text
      // Normalize whitespace
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/ {2,}/g, ' ')
      // Remove control characters
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
      // Collapse multiple newlines
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Extract text from Markdown (strip formatting)
   * @param {string} markdown
   * @returns {string}
   */
  static stripMarkdown(markdown) {
    return markdown
      // Remove headers markers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
      // Remove links [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove images
      .replace(/!\[.*?\]\(.*?\)/g, '')
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}\s*$/gm, '')
      .trim();
  }
}

module.exports = TextChunker;
