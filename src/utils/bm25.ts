interface BM25Params {
  k1?: number; // Term frequency saturation parameter
  b?: number;  // Length normalization parameter
}

export function calculateBM25Score(
  query: string,
  document: string,
  params: BM25Params = {}
): number {
  const { k1 = 1.5, b = 0.75 } = params;

  // Tokenize query and document
  const queryTerms = query.toLowerCase().split(/\s+/);
  const docTerms = document.toLowerCase().split(/\s+/);

  // Calculate document length and average document length
  const docLength = docTerms.length;
  const avgDocLength = docLength; // In a real implementation, this would be the average across all documents

  let score = 0;

  // Count term frequencies
  const termFreq = new Map<string, number>();
  for (const term of docTerms) {
    termFreq.set(term, (termFreq.get(term) || 0) + 1);
  }

  // Calculate BM25 score for each query term
  for (const term of queryTerms) {
    const tf = termFreq.get(term) || 0;
    if (tf === 0) continue;

    // IDF would normally be calculated across all documents
    // Here we use a simplified version
    const idf = 1.0;

    // BM25 score for this term
    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + b * docLength / avgDocLength);
    score += idf * numerator / denominator;
  }

  return score;
} 