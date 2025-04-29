import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import { addDocument } from "./chromadb";
import { DocumentType, Document } from "../types";
import { responsePromptTemplate } from "../prompts";
import { OpenAI, OpenAIEmbedding } from "@llamaindex/openai";

dotenv.config();

const openai = new OpenAI({
  model: "gpt-4o-mini",
  apiKey: process.env.OPENAI_API_KEY,
});

const embedModel = new OpenAIEmbedding({
  model: "text-embedding-3-large",
  apiKey: process.env.OPENAI_API_KEY,
});

/* This function is used to generate an embedding for a given text.
   It can be used to generate an embedding for a document or a question. */ 
export const generateEmbedding = async (
  text: string,
  type: "document" | "question"
) => {
  try {
    let embedding: any;
    if (type === "document") {
      // const textChunks = text.split("\n\n");
      embedding = await embedModel.getTextEmbedding(text);
      console.log("Embedding generated:", embedding);

      // Create a document with the embedding
        await addDocument({
          id: uuidv4(),
          content: text,
          embedding: embedding,
          title: "NSE FAQs",
          type: DocumentType.FAQ,
          tags: ["nse", "faqs"],
        });
    } else {
      embedding = await embedModel.getTextEmbedding(text);
      console.log("Embedding generated:", embedding);
    }

    return embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error("Failed to generate embedding");
  }
};

/* This function is used to process a query and return the answer and confidence score. */
export const processQuery = async (query: string, documents: Document[]) => {
  try {
    const context = documents
      .map((doc) => doc.content)
      .join("\n\n")
      .slice(0, 1000);
    const prompt = responsePromptTemplate.format({
      context,
      query,
    });
    const completion = await openai.complete({
      prompt,
    });
    const responseText = completion.text || "";
    // const confidence = calculateConfidence(responseText, documents);
    return {
      answer: responseText,
      confidence: 0.6,
    };
  } catch (error) {
    console.error("Error processing query:", error);
    throw new Error("Failed to process query");
  }
};

