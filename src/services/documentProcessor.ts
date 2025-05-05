import * as fs from "fs";
import pdf from "pdf-parse";
import * as xlsx from "xlsx";
import { v4 as uuid } from "uuid";
import * as cheerio from "cheerio";
import { initialize, addDocument } from "./chromadb";
import { Document, DocumentType, ChunkOptions } from "../types";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export class DocumentProcessor {
  private static readonly DEFAULT_CHUNK_OPTIONS: ChunkOptions = {
    minLength: 100,
    maxLength: 1000,
    overlap: 200,
  };

  // Process different file formats
  static async processFile(
    filePath: string,
    fileType: string,
    options: ChunkOptions = DocumentProcessor.DEFAULT_CHUNK_OPTIONS
  ): Promise<Document[]> {
    let text: string;
    
    switch (fileType.toLowerCase()) {
      case "pdf":
        text = await DocumentProcessor.processPDF(filePath);
        break;
      case "html":
        text = await DocumentProcessor.processHTML(filePath);
        break;
      case "xlsx":
        text = await DocumentProcessor.processExcel(filePath);
        break;
      case "txt":
        text = await DocumentProcessor.processText(filePath);
        break;
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    return await DocumentProcessor.createChunks(text, options);
  }

  // Process PDF files
  private static async processPDF(filePath: string): Promise<string> {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  }

  // Process HTML files
  private static async processHTML(filePath: string): Promise<string> {
    const html = fs.readFileSync(filePath, "utf-8");
    const $ = cheerio.load(html);
    
    // Remove script and style elements
    $("script, style").remove();
    return $("body").text();
  }

  // Process Excel files
  private static async processExcel(filePath: string): Promise<string> {
    const workbook = xlsx.readFile(filePath);
    const sheets = workbook.SheetNames;
    let text = "";

    for (const sheet of sheets) {
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheet]);
      text += JSON.stringify(data, null, 2) + "\n\n";
    }

    return text;
  }

  // Process text files
  private static async processText(filePath: string): Promise<string> {
    return fs.readFileSync(filePath, "utf-8");
  }

  // Create semantic chunks with overlap
  private static async createChunks(
    text: string,
    options: ChunkOptions
  ): Promise<Document[]> {
    await initialize();
    
    const { minLength = 100, maxLength = 1000, overlap = 200 } = options;
    
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: maxLength,
      chunkOverlap: overlap,
      lengthFunction: (text) => text.length,
    });

    const chunks = await splitter.createDocuments([text]);
    const documents: Document[] = [];

    for (const chunk of chunks) {
      if (chunk.pageContent.length >= minLength) {
        const doc: Document = {
          id: uuid(),
          title: "",
          content: chunk.pageContent.trim(),
          embedding: [], // Embeddings will be handled by ChromaDB
          type: DocumentType.FAQ,
          tags: [],
        };
        
        await addDocument(doc);
        documents.push(doc);
      }
    }

    return documents;
  }
} 