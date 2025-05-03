import { Document } from "../types";

// Helper function to calculate BLEU score
export const calculateBLEU = (response: string, reference: string): number => {
  const responseTokens = response.toLowerCase().split(/\s+/);
  const referenceTokens = reference.toLowerCase().split(/\s+/);

  // Calculate n-gram precision (we'll use up to 4-grams)
  const maxN = Math.min(4, responseTokens.length, referenceTokens.length);
  let totalPrecision = 0;

  for (let n = 1; n <= maxN; n++) {
    const responseCounts = new Map<string, number>();
    const referenceCounts = new Map<string, number>();

    // Count n-grams in response
    for (let i = 0; i <= responseTokens.length - n; i++) {
      const ngram = responseTokens.slice(i, i + n).join(" ");
      responseCounts.set(ngram, (responseCounts.get(ngram) || 0) + 1);
    }

    // Count n-grams in reference
    for (let i = 0; i <= referenceTokens.length - n; i++) {
      const ngram = referenceTokens.slice(i, i + n).join(" ");
      referenceCounts.set(ngram, (referenceCounts.get(ngram) || 0) + 1);
    }

    // Calculate precision for this n
    let matches = 0;
    let total = 0;

    for (const [ngram, count] of responseCounts) {
      const refCount = referenceCounts.get(ngram) || 0;
      matches += Math.min(count, refCount);
      total += count;
    }

    totalPrecision += matches / (total || 1);
  }

  // Average precision across n-grams
  const averagePrecision = totalPrecision / maxN;

  // Apply brevity penalty
  const brevityPenalty = Math.exp(
    Math.min(0, 1 - referenceTokens.length / (responseTokens.length || 1))
  );

  return brevityPenalty * averagePrecision;
};

// Helper function to calculate ROUGE score
export const calculateROUGE = (response: string, reference: string): number => {
  const responseTokens = response.toLowerCase().split(/\s+/);
  const referenceTokens = reference.toLowerCase().split(/\s+/);

  // Create sets of tokens for overlap calculation
  const responseSet = new Set(responseTokens);
  const referenceSet = new Set(referenceTokens);

  // Calculate overlap
  let overlap = 0;
  for (const token of responseSet) {
    if (referenceSet.has(token)) {
      overlap++;
    }
  }

  // Calculate recall and precision
  const recall = overlap / (referenceSet.size || 1);
  const precision = overlap / (responseSet.size || 1);

  // Calculate F1 score (ROUGE-1)
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
};

// Helper function to calculate confidence score
export const calculateConfidence = (
  response: string,
  documents: Document[]
): number => {
  // Basic confidence calculation based on:
  // 1. Number of relevant documents found
  // 2. Length of the response (too short or too long might indicate low confidence)
  // 3. Presence of uncertainty markers in the response
  // 4. BLEU score against relevant documents
  // 5. ROUGE score against relevant documents

  let score = 0.3; // Reduced base score to accommodate new metrics

  // Factor 1: Number of relevant documents (15% weight)
  score += Math.min(documents.length / 5, 0.15);

  // Factor 2: Response length (15% weight)
  const responseLength = response.length;
  if (responseLength > 50 && responseLength < 1000) {
    score += 0.15;
  } else {
    score -= 0.1;
  }

  // Factor 3: Uncertainty markers (20% weight)
  const uncertaintyPhrases = [
    "not sure",
    "might be",
    "could be",
    "possibly",
    "I think",
    "uncertain",
    "unclear",
  ];
  const hasUncertainty = uncertaintyPhrases.some((phrase) =>
    response.toLowerCase().includes(phrase)
  );
  if (hasUncertainty) {
    score -= 0.2;
  }

  // Factor 4 & 5: BLEU and ROUGE scores (25% weight each)
  if (documents.length > 0) {
    const referenceText = documents.map((doc) => doc.content).join(" ");
    const bleuScore = calculateBLEU(response, referenceText);
    const rougeScore = calculateROUGE(response, referenceText);

    score += bleuScore * 0.25; // 25% weight for BLEU
    score += rougeScore * 0.25; // 25% weight for ROUGE
  }

  // Ensure score is between 0 and 1
  return Math.max(0, Math.min(1, score));
};
