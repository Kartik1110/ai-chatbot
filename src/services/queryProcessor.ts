import dotenv from "dotenv";
import { ChatOpenAI } from "@langchain/openai";
import { HybridSearch } from "./hybridSearch";
import { Document, ProcessedQuery } from "../types";

dotenv.config();

export class QueryProcessor {
  private openai: ChatOpenAI;
  private hybridSearch: HybridSearch;

  constructor() {
    this.openai = new ChatOpenAI({
      model: "gpt-4o",
      apiKey: process.env.OPENAI_API_KEY,
      maxTokens: 500,
    });
    this.hybridSearch = new HybridSearch();
  }

  async initialize(): Promise<void> {
    await this.hybridSearch.initialize();
  }

  async processQuery(query: string): Promise<ProcessedQuery> {
    // Step 1: Rewrite query for better retrieval
    // const rewrittenQuery = await this.rewriteQuery(query);

    // Step 2: Retrieve relevant documents
    const documents = await this.hybridSearch.search(query);

    // Step 3: Generate response with enhanced prompting
    const response = await this.generateResponse(query, documents);

    return {
      rewrittenQuery: query,
      answer: response.answer,
      confidence: response.confidence,
      sources: documents,
    };
  }

  private async rewriteQuery(query: string): Promise<string> {
    const prompt = `Rewrite the following user query to be more specific and self-contained. 
Add any missing context that would help with document retrieval.
Keep the rewritten query concise and focused.

Original query: "${query}"

Rewritten query:`;

    const completion = await this.openai.invoke([{
      role: "user",
      content: prompt,
    }]);

    return completion.text.trim();
  }

  private async generateResponse(
    query: string,
    documents: Document[]
  ): Promise<{ answer: string; confidence: number }> {
    // Prepare context from documents
    const context = documents
      .map((doc) => `[${doc.type}] ${doc.content}`)
      .join("\n\n");

    console.log("context", context);

    // Create prompt with few-shot examples and instructions
    const prompt = `You are a financial services assistant specializing in Fixed Deposits and Unlisted Shares.
Use ONLY the information provided in the context below to answer the question.
If the context doesn't contain enough information to answer confidently, say so.
If numbers or specific details are mentioned in the context, use them exactly as stated.

Context:
${context}

Current Question: ${query}

Answer:`;

    const completion = await this.openai.invoke([{
      role: "user",
      content: prompt,
    }]);

    // Calculate confidence based on answer characteristics
    const answer = completion.text.trim();
    // const confidence = this.calculateConfidence(answer, documents);

    return { answer, confidence: 0.5 };
  }

  private calculateConfidence(answer: string, documents: Document[]): number {
    let confidence = 0.5; // Base confidence

    // Factor 1: Presence of uncertainty markers (20% weight)
    const uncertaintyPhrases = [
      "don't have enough information",
      "not sure",
      "might be",
      "could be",
      "possibly",
      "I think",
      "unclear",
    ];
    if (
      uncertaintyPhrases.some((phrase) => answer.toLowerCase().includes(phrase))
    ) {
      confidence -= 0.2;
    }

    // Factor 2: Document relevance (30% weight)
    if (documents.length > 0) {
      confidence += Math.min(documents.length / 5, 1) * 0.3;
    }

    // Factor 3: Answer length and quality (20% weight)
    const wordCount = answer.split(/\s+/).length;
    if (wordCount > 20 && wordCount < 200) {
      confidence += 0.2;
    }

    // Factor 4: Numerical precision (30% weight)
    const hasNumbers = /₹?\d+([.,]\d+)?%?/.test(answer);
    const hasNumbersInDocs = documents.some((doc) =>
      /₹?\d+([.,]\d+)?%?/.test(doc.content)
    );
    if (hasNumbers && hasNumbersInDocs) {
      confidence += 0.3;
    }

    return Math.max(0, Math.min(1, confidence));
  }
}
