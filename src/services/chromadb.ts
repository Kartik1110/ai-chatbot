import { Document } from "../types";
import { generateEmbedding } from "./llamaindex";
import { ChromaClient, Collection, GetCollectionParams } from "chromadb";

let client: ChromaClient | null = null;
let collection: Collection | null = null;

const getClient = (): ChromaClient => {
  if (!client) {
    client = new ChromaClient();
  }
  return client;
};

export const getCollection = (): Collection | null => {
  return collection;
};

export const getCollections = async (): Promise<string[]> => {
  const chromaClient = getClient();
  return await chromaClient.listCollections();
};

export const initialize = async (): Promise<void> => {
  const chromaClient = getClient();
  try {
    collection = await chromaClient.createCollection({
      name: "yoda_documents",
      metadata: { description: "Collection for Yoda AI Assistant documents" },
    });
  } catch (error) {
    // Collection might already exist
    const params: GetCollectionParams = {
      name: "yoda_documents",
      embeddingFunction: {
        generate: async (texts: string[]): Promise<any> => {
          try {
            // Process each text to get its embedding
            const embeddings = await Promise.all(
              texts.map(
                async (text) => await generateEmbedding(text, "document")
              )
            );

            return embeddings;
          } catch (error) {
            console.error("Error generating embeddings:", error);
            // Fallback to placeholder embeddings if there's an error
            return texts.map(() => Array(1536).fill(0));
          }
        },
      },
    };
    collection = await chromaClient.getCollection(params);
  }
};

export const addDocument = async (document: Document): Promise<void> => {
  const currentCollection = getCollection();
  if (!currentCollection) {
    throw new Error("Collection not initialized");
  }
  await currentCollection.add({
    ids: [document.id],
    embeddings: [document.embedding],
    metadatas: [
      {
        title: document.title,
        type: document.type,
        tags: document.tags.join(","),
      },
    ],
    documents: [document.content],
  });
};

export const queryDocuments = async (
  queryEmbedding: number[],
  limit = 3
): Promise<Document[]> => {
  const currentCollection = getCollection();
  if (!currentCollection) {
    throw new Error("Collection not initialized");
  }

  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    throw new Error("Invalid query embedding provided");
  }

  const results = await currentCollection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: limit,
  });

  if (!results.documents?.[0] || !results.ids?.[0] || !results.metadatas?.[0]) {
    return [];
  }

  return results.documents[0].map((content, index) => {
    const metadata = results.metadatas![0][index];
    const id = results.ids![0][index];

    if (!content || !metadata || !id) {
      throw new Error("Invalid document data received from ChromaDB");
    }

    return {
      id,
      content,
      embedding: [],
      title: String(metadata.title || ""),
      type: (metadata.type as Document["type"]) || "FAQ",
      tags: String(metadata.tags || "")
        .split(",")
        .filter(Boolean),
    };
  });
};
