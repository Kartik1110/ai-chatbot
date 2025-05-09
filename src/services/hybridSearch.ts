import { generateEmbedding } from "./langchain";
import { Document, SearchResult } from "../types";
import { calculateBM25Score } from "../utils/bm25";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";

import dotenv from "dotenv";

dotenv.config();

const COLLECTION_NAME = "yoda_documents";
const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-large",
  apiKey: process.env.OPENAI_API_KEY,
});

export class HybridSearch {
  private vectorStore: Chroma | null = null;
  private documents: Document[] = [];

  async initialize(): Promise<void> {
    try {
      // Try to load existing collection
      this.vectorStore = await Chroma.fromExistingCollection(embeddings, {
        collectionName: COLLECTION_NAME,
        url: process.env.CHROMA_DB_PATH,
      });
    } catch (error) {
      // If collection doesn't exist, create a new one (empty)
      this.vectorStore = await Chroma.fromDocuments([], embeddings, {
        collectionName: COLLECTION_NAME,
        collectionMetadata: {
          description: "Collection for Yoda AI Assistant documents",
        },
      });
    }

    // Load all documents for BM25
    if (this.vectorStore) {
      // Chroma does not provide a direct way to get all documents, so we assume a method exists or you maintain a separate store
      // For now, we will skip reloading all documents and assume they are managed elsewhere
      // If you have a way to fetch all documents, load them here
      // Example: this.documents = await fetchAllDocuments();
    }
  }

  async search(query: string, limit: number = 5): Promise<Document[]> {
    if (!this.vectorStore) {
      await this.initialize();
      if (!this.vectorStore) {
        throw new Error("Failed to initialize vector store");
      }
    }

    try {
      // Get dense vector search results
      const queryEmbedding = await generateEmbedding(query, "question");
      const denseResults = await this.vectorStore.similaritySearchVectorWithScore(
        queryEmbedding,
        limit * 2
      );

      // Convert dense results to SearchResult[]
      const denseSearchResults: SearchResult[] = denseResults.map(([doc, _score], i) => ({
        document: {
          id: doc.metadata.id || "",
          content: doc.pageContent,
          embedding: [],
          title: doc.metadata.title || "",
          type: doc.metadata.type || "FAQ",
          tags: (doc.metadata.tags || "").split(",").filter(Boolean),
        },
        score: 1 - i / denseResults.length, // position-based score
      }));

      // BM25 results (if you have all documents loaded)
      let bm25Results: SearchResult[] = [];
      if (this.documents.length > 0) {
        bm25Results = this.documents.map((doc) => ({
          document: doc,
          score: calculateBM25Score(query, doc.content),
        }));
        bm25Results.sort((a, b) => b.score - a.score);
        bm25Results = bm25Results.slice(0, limit * 2);
      }

      // Combine and rerank results
      const combinedResults = this.fuseResults(
        denseSearchResults,
        bm25Results
      );

      // Return top K results after fusion
      return combinedResults.slice(0, limit).map((result) => result.document);
    } catch (error) {
      console.error("Error during search:", error);
      throw new Error("Failed to perform search");
    }
  }

  private fuseResults(
    denseResults: SearchResult[],
    bm25Results: SearchResult[]
  ): SearchResult[] {
    const fusedResults = new Map<string, SearchResult>();
    const k = 60; // fusion parameter

    denseResults.forEach((result, rank) => {
      const score = 1 / (rank + k);
      fusedResults.set(result.document.id, {
        document: result.document,
        score: score,
      });
    });

    bm25Results.forEach((result, rank) => {
      const score = 1 / (rank + k);
      if (fusedResults.has(result.document.id)) {
        const existing = fusedResults.get(result.document.id)!;
        existing.score += score;
      } else {
        fusedResults.set(result.document.id, {
          document: result.document,
          score: score,
        });
      }
    });

    return Array.from(fusedResults.values()).sort((a, b) => b.score - a.score);
  }
}
