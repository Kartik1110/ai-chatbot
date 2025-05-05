import { z } from 'zod';

// Document schema for ChromaDB
export enum DocumentType {
  FAQ = 'FAQ',
  SOP = 'SOP',
  HelpDoc = 'HelpDoc'
}

export interface Document {
  id: string;
  title: string;
  content: string;
  embedding: number[];
  type: DocumentType;
  tags: string[];
}

// Query request schema
export const QueryRequestSchema = z.object({
  query: z.string().min(1),
  userId: z.string().optional(),
});

export type QueryRequest = z.infer<typeof QueryRequestSchema>;

// Query response schema
export interface QueryResponse {
  answer: string;
  confidence: number;
  sources?: {
    title: string;
    content: string;
    type: Document['type'];
  }[];
}

// Feedback schema
export const FeedbackSchema = z.object({
  queryId: z.string(),
  isHelpful: z.boolean(),
  comments: z.string().optional(),
});

export type Feedback = z.infer<typeof FeedbackSchema>;

// Suggestion response schema
export interface Suggestion {
  id: string;
  title: string;
  type: Document['type'];
  tags: string[];
} 

export interface ChunkOptions {
  minLength?: number;
  maxLength?: number;
  overlap?: number;
}

export interface ProcessedQuery {
  rewrittenQuery: string;
  answer: string;
  confidence: number;
  sources: Document[];
}

export interface SearchResult {
  document: Document;
  score: number;
}
