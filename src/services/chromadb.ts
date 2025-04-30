import { Document } from "../types";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";

let vectorStore: Chroma | null = null;
const COLLECTION_NAME = "yoda_documents";

const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-large",
});

export const getVectorStore = (): Chroma | null => {
  return vectorStore;
};

export const getCollections = async (): Promise<string[]> => {
  if (!vectorStore) {
    throw new Error("Vector store not initialized");
  }
  return [COLLECTION_NAME];
};

export const initialize = async (): Promise<void> => {
  try {
    // Initialize or get existing Chroma instance
    vectorStore = await Chroma.fromExistingCollection(embeddings, {
      collectionName: COLLECTION_NAME,
    });
  } catch (error) {
    // If collection doesn't exist, create a new one
    vectorStore = await Chroma.fromDocuments(
      [], // Start with empty documents
      embeddings,
      {
        collectionName: COLLECTION_NAME,
        collectionMetadata: {
          description: "Collection for Yoda AI Assistant documents",
        },
      }
    );
  }
};

export const addDocument = async (document: Document): Promise<void> => {
  if (!vectorStore) {
    throw new Error("Vector store not initialized");
  }

  await vectorStore.addDocuments([
    {
      pageContent: document.content,
      metadata: {
        id: document.id,
        title: document.title,
        type: document.type,
        tags: document.tags.join(","),
      },
    },
  ]);
};

export const queryDocuments = async (
  queryEmbedding: number[],
  limit = 3
): Promise<Document[]> => {
  if (!vectorStore) {
    throw new Error("Vector store not initialized");
  }

  // Use the underlying Chroma client to search with raw embeddings
  const results = await vectorStore.similaritySearchVectorWithScore(
    queryEmbedding,
    limit
  );

  return results.map(([doc, _score]) => ({
    id: doc.metadata.id || "",
    content: doc.pageContent,
    embedding: [], // We don't return embeddings in results
    title: doc.metadata.title || "",
    type: doc.metadata.type || "FAQ",
    tags: (doc.metadata.tags || "").split(",").filter(Boolean),
  }));
};
