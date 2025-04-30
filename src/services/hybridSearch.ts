import { generateEmbedding } from "./llamaindex";
import { Document, SearchResult } from "../types";
import { calculateBM25Score } from "../utils/bm25";
import { ChromaClient, Collection, GetCollectionParams } from "chromadb";

export class HybridSearch {
  private chromaClient: ChromaClient;
  private collection: Collection | null = null;
  private documents: Document[] = [];

  constructor() {
    this.chromaClient = new ChromaClient();
  }

  async initialize(collectionName: string = "yoda_documents"): Promise<void> {
    try {
      this.collection = await this.chromaClient.createCollection({
        name: collectionName,
        metadata: { description: "Collection for Yoda AI Assistant documents" },
      });
    } catch (error) {
      // Collection might already exist
      const params: GetCollectionParams = {
        name: collectionName,
        embeddingFunction: {
          generate: async (texts: string[]): Promise<number[][]> => {
            const embeddings = await Promise.all(
              texts.map(
                async (text) => await generateEmbedding(text, "document")
              )
            );
            return embeddings;
          },
        },
      };
      this.collection = await this.chromaClient.getCollection(params);
    }

    // Load documents for BM25
    const results = await this.collection.get();
    this.documents = results.documents.map((content, index) => ({
      id: results.ids[index],
      content: content as string,
      title: String(results.metadatas[index]?.title || ""),
      type: String(results.metadatas[index]?.type || "FAQ") as Document["type"],
      tags: String(results.metadatas[index]?.tags || "").split(","),
      embedding: [],
    }));
  }

  async search(query: string, limit: number = 5): Promise<Document[]> {
    if (!this.collection) {
      // Only initialize if not already initialized
      await this.initialize();
      if (!this.collection) {
        throw new Error("Failed to initialize collection");
      }
    }

    try {
      // Get dense vector search results
      const queryEmbedding = await generateEmbedding(query, "question");
      const denseResults = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit * 2, // Get more results for better fusion
      });

      if (!denseResults.ids?.[0] || !denseResults.documents?.[0]) {
        return []; // Return empty array if no results found
      }

      // Get sparse BM25 search results
      const bm25Results = this.documents.map((doc) => ({
        document: doc,
        score: calculateBM25Score(query, doc.content),
      }));

      // Sort BM25 results by score and take top results
      bm25Results.sort((a, b) => b.score - a.score);
      const topBM25Results = bm25Results.slice(0, limit * 2);

      // Combine and rerank results
      const combinedResults = this.fuseResults(
        this.convertDenseResults(denseResults, limit * 2),
        topBM25Results
      );

      // Return top K results after fusion
      return combinedResults.slice(0, limit).map((result) => result.document);
    } catch (error) {
      console.error("Error during search:", error);
      throw new Error("Failed to perform search");
    }
  }

  private convertDenseResults(
    denseResults: any,
    limit: number
  ): SearchResult[] {
    const results: SearchResult[] = [];

    for (
      let i = 0;
      i < Math.min(limit, denseResults.documents[0].length);
      i++
    ) {
      // Use position-based scoring since we don't have distances
      const score = 1 - i / denseResults.documents[0].length;

      results.push({
        document: {
          id: denseResults.ids[0][i],
          content: denseResults.documents[0][i],
          title: denseResults.metadatas[0][i]?.title || "",
          type: denseResults.metadatas[0][i]?.type || "FAQ",
          tags: (denseResults.metadatas[0][i]?.tags || "").split(","),
          embedding: [], // Not needed for results
        },
        score,
      });
    }

    return results;
  }

  private fuseResults(
    denseResults: SearchResult[],
    bm25Results: SearchResult[]
  ): SearchResult[] {
    const fusedResults = new Map<string, SearchResult>();

    // Combine scores using reciprocal rank fusion
    const k = 60; // fusion parameter

    // Process dense results
    denseResults.forEach((result, rank) => {
      const score = 1 / (rank + k);
      fusedResults.set(result.document.id, {
        document: result.document,
        score: score,
      });
    });

    // Process BM25 results
    bm25Results.forEach((result, rank) => {
      const score = 1 / (rank + k);
      if (fusedResults.has(result.document.id)) {
        // If document exists in dense results, combine scores
        const existing = fusedResults.get(result.document.id)!;
        existing.score += score;
      } else {
        fusedResults.set(result.document.id, {
          document: result.document,
          score: score,
        });
      }
    });

    // Convert map to array and sort by score
    return Array.from(fusedResults.values()).sort((a, b) => b.score - a.score);
  }
}
